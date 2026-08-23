import AppKit
import CryptoKit
import Darwin
import DeviceCheck
import Foundation
import Security
import WebKit

private let keychainService = "dev.forkit.ai-footprints.app-attest"
private let keychainAccount = "verified-installation"

private enum LauncherError: Error {
    case appAttestUnavailable, invalidHash, keyMissing, resourceMissing
    case keychain(OSStatus)
}

private func emit(_ value: [String: Any]) {
    guard let data = try? JSONSerialization.data(withJSONObject: value, options: [.sortedKeys]),
          let line = String(data: data, encoding: .utf8) else { return }
    FileHandle.standardOutput.write(Data("\(line)\n".utf8))
}

private func base64url(_ data: Data) -> String {
    data.base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
}

private func dataFromHex(_ value: String) throws -> Data {
    guard value.count == 64, value.allSatisfy({ $0.isHexDigit }) else { throw LauncherError.invalidHash }
    var bytes = Data(capacity: 32); var index = value.startIndex
    for _ in 0..<32 { let next = value.index(index, offsetBy: 2); guard let byte = UInt8(value[index..<next], radix: 16) else { throw LauncherError.invalidHash }; bytes.append(byte); index = next }
    return bytes
}

private func storedKeyId() throws -> String? {
    let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: keychainService, kSecAttrAccount as String: keychainAccount, kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne]
    var result: CFTypeRef?; let status = SecItemCopyMatching(query as CFDictionary, &result)
    if status == errSecItemNotFound { return nil }
    guard status == errSecSuccess, let data = result as? Data, let keyId = String(data: data, encoding: .utf8) else { throw LauncherError.keychain(status) }
    return keyId
}

private func storeKeyId(_ keyId: String) throws {
    let keyData = Data(keyId.utf8)
    let lookup: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: keychainService, kSecAttrAccount as String: keychainAccount]
    let update = SecItemUpdate(lookup as CFDictionary, [kSecValueData as String: keyData] as CFDictionary)
    if update == errSecSuccess { return }
    guard update == errSecItemNotFound else { throw LauncherError.keychain(update) }
    var addition = lookup; addition[kSecValueData as String] = keyData; addition[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
    let added = SecItemAdd(addition as CFDictionary, nil); guard added == errSecSuccess else { throw LauncherError.keychain(added) }
}

private func capability() -> [String: Any] {
    let os = ProcessInfo.processInfo.operatingSystemVersion
    let supported = DCAppAttestService.shared.isSupported
    return ["schema_version": "1.0", "platform": "darwin", "os_major": os.majorVersion, "app_attest_supported": supported, "ready_for_verified_global": supported, "network_request_made": false]
}

private func runAppAttestCommand(_ arguments: [String]) async throws {
    guard let command = arguments.first else { emit(capability()); return }
    if command == "status" { emit(capability()); return }
    let service = DCAppAttestService.shared; guard service.isSupported else { throw LauncherError.appAttestUnavailable }
    if command == "generate-key" {
        if let existing = try storedKeyId() { emit(["ok": true, "key_id": existing, "reused": true]); return }
        let keyId = try await service.generateKey(); try storeKeyId(keyId); emit(["ok": true, "key_id": keyId, "reused": false]); return
    }
    guard arguments.count == 2 else { throw LauncherError.invalidHash }
    let hash = try dataFromHex(arguments[1]); guard let keyId = try storedKeyId() else { throw LauncherError.keyMissing }
    if command == "attest" { emit(["ok": true, "key_id": keyId, "attestation": base64url(try await service.attestKey(keyId, clientDataHash: hash))]); return }
    if command == "assert" { emit(["ok": true, "key_id": keyId, "assertion": base64url(try await service.generateAssertion(keyId, clientDataHash: hash))]); return }
    throw LauncherError.invalidHash
}

@MainActor
private final class FootprintsAppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate {
    private let arguments: [String]
    private let nativeToken = UUID().uuidString + UUID().uuidString
    private var nodeProcess: Process?
    private var outputPipe: Pipe?
    private var outputBuffer = ""
    private var serverURL: URL?
    private var window: NSWindow?
    private var webView: WKWebView?
    private var statusItem: NSStatusItem?
    private var headerLine: NSMenuItem?
    private var statusLine: NSMenuItem?
    private var monitorAction: NSMenuItem?
    private var statusTimer: Timer?
    private var latestStatus: [String: Any] = [:]
    private var shuttingDown = false

    init(arguments: [String]) { self.arguments = arguments }

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)
        setupStatusItem()
        do { try startNodeService() }
        catch { showFatalError("The local AI Footprints service could not start.") }
    }

    private func setupStatusItem() {
        let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        item.autosaveName = "ForkitAI FootprintStatusItem"
        item.isVisible = true
        if let image = NSImage(systemSymbolName: "waveform.path.ecg", accessibilityDescription: "Forkit AI Footprint") {
            image.isTemplate = true
            item.button?.image = image.withSymbolConfiguration(.init(pointSize: 15, weight: .semibold)) ?? image
            item.button?.imagePosition = .imageOnly
        } else {
            item.button?.title = "F"
            item.button?.font = .systemFont(ofSize: 13, weight: .bold)
        }
        item.button?.toolTip = "Forkit AI Footprint"
        let menu = NSMenu()
        let header = NSMenuItem(title: "Forkit AI Footprint", action: nil, keyEquivalent: "")
        header.isEnabled = false; menu.addItem(header)
        let status = NSMenuItem(title: "○ Stopped", action: nil, keyEquivalent: "")
        status.isEnabled = false; menu.addItem(status); menu.addItem(.separator())
        menu.addItem(NSMenuItem(title: "Open AI Footprint", action: #selector(showFootprint), keyEquivalent: "o"))
        let toggle = NSMenuItem(title: "Start Monitoring", action: #selector(toggleMonitoring), keyEquivalent: "m")
        menu.addItem(toggle); menu.addItem(.separator())
        menu.addItem(NSMenuItem(title: "Quit Forkit", action: #selector(requestQuit), keyEquivalent: "q"))
        for menuItem in menu.items { menuItem.target = self }
        item.menu = menu; statusItem = item; headerLine = header; statusLine = status; monitorAction = toggle
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self, weak item] in
            guard let self, let item else { return }
            let imageReady = item.button?.image != nil || !(item.button?.title.isEmpty ?? true)
            NSLog("Forkit status item retained=%@ visible=%@ image=%@ menu=%@", self.statusItem === item ? "yes" : "no", item.isVisible ? "yes" : "no", imageReady ? "yes" : "no", item.menu?.items.map(\.title).joined(separator: " | ") ?? "missing")
        }
    }

    private func startNodeService() throws {
        guard let resources = Bundle.main.resourceURL else { throw LauncherError.resourceMissing }
        let process = Process(); process.executableURL = resources.appendingPathComponent("runtime/node")
        process.arguments = [resources.appendingPathComponent("app/dist/cli.js").path, "serve"] + arguments
        var environment = ProcessInfo.processInfo.environment
        environment["FORKIT_AI_FOOTPRINTS_APP_BUNDLE"] = "1"
        environment["FORKIT_AI_FOOTPRINTS_NO_OPEN"] = "1"
        environment["FORKIT_AI_FOOTPRINTS_NATIVE_TOKEN"] = nativeToken
        process.environment = environment
        let pipe = Pipe(); outputPipe = pipe; process.standardOutput = pipe; process.standardError = FileHandle.standardError
        process.terminationHandler = { [weak self] task in
            Task { @MainActor in self?.serviceTerminated(task.terminationStatus) }
        }
        try process.run(); nodeProcess = process
        let readyData = pipe.fileHandleForReading.availableData
        guard !readyData.isEmpty, let readyText = String(data: readyData, encoding: .utf8) else { throw LauncherError.resourceMissing }
        consumeOutput(readyText)
    }

    private func consumeOutput(_ text: String) {
        outputBuffer += text
        while let newline = outputBuffer.firstIndex(of: "\n") {
            let line = String(outputBuffer[..<newline]); outputBuffer.removeSubrange(...newline)
            guard let range = line.range(of: "http://127.0.0.1:[0-9]+/", options: .regularExpression), let url = URL(string: String(line[range])) else { continue }
            serverURL = url; openWindow(url); beginStatusPolling()
        }
    }

    private func openWindow(_ url: URL) {
        let configuration = WKWebViewConfiguration()
        let view = WKWebView(frame: .zero, configuration: configuration)
        let controller = NSViewController(); controller.view = view
        let window = NSWindow(contentViewController: controller)
        window.title = "Forkit AI Footprints"; window.setContentSize(NSSize(width: 1120, height: 780)); window.minSize = NSSize(width: 760, height: 620)
        window.center(); window.delegate = self; window.isReleasedWhenClosed = false
        self.webView = view; self.window = window
        view.load(URLRequest(url: url)); showFootprint()
    }

    private func beginStatusPolling() {
        refreshStatus()
        let timer = Timer(timeInterval: 1.0, repeats: true) { [weak self] _ in Task { @MainActor in self?.refreshStatus() } }
        statusTimer = timer
        RunLoop.main.add(timer, forMode: .common)
    }

    private func post(_ path: String, completion: @escaping ([String: Any]?) -> Void) {
        guard let base = serverURL, let url = URL(string: path, relativeTo: base) else { completion(nil); return }
        var request = URLRequest(url: url); request.httpMethod = "POST"; request.setValue(nativeToken, forHTTPHeaderField: "x-forkit-footprints-native")
        URLSession.shared.dataTask(with: request) { data, _, _ in
            let value: [String: Any]?
            if let data, let decoded = try? JSONSerialization.jsonObject(with: data) as? [String: Any] { value = decoded }
            else { value = nil }
            DispatchQueue.main.async { completion(value) }
        }.resume()
    }

    private func refreshStatus() {
        post("/api/native/status") { [weak self] value in
            guard let self, let value else { self?.statusLine?.title = "○ Service unavailable"; return }
            self.latestStatus = value
            let monitoring = value["lifecycle"] as? String == "monitoring"
            let products = value["products"] as? [[String: Any]] ?? []
            let working = products.filter { $0["state"] as? String == "working-now" }.count
            self.statusLine?.title = monitoring ? (working > 0 ? "● Monitoring · \(working) working" : "● Monitoring") : "○ Stopped"
            self.monitorAction?.title = monitoring ? "Stop Monitoring" : "Start Monitoring"
        }
    }

    @objc private func showFootprint() {
        guard let window else { return }
        window.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true)
    }

    @objc private func toggleMonitoring() {
        let monitoring = latestStatus["lifecycle"] as? String == "monitoring"
        post(monitoring ? "/api/native/stop" : "/api/native/start") { [weak self] value in
            if let value { self?.latestStatus = value }
            self?.refreshStatus()
        }
    }

    func windowShouldClose(_ sender: NSWindow) -> Bool {
        sender.orderOut(nil)
        let defaults = UserDefaults.standard
        if !defaults.bool(forKey: "ForkitFootprintsCloseNoticeHidden") {
            let alert = NSAlert(); alert.messageText = "Forkit is still available in the menu bar"
            alert.informativeText = "Closing this window does not stop monitoring. Reopen the same session from the Forkit icon in the menu bar. If the menu bar is hidden in full screen, move the pointer to the top edge first."
            alert.addButton(withTitle: "Got it"); alert.showsSuppressionButton = true; alert.suppressionButton?.title = "Don’t show again"
            alert.runModal()
            if alert.suppressionButton?.state == .on { defaults.set(true, forKey: "ForkitFootprintsCloseNoticeHidden") }
        }
        return false
    }

    @objc private func requestQuit() {
        refreshStatus()
        if latestStatus["lifecycle"] as? String == "monitoring" {
            let alert = NSAlert(); alert.messageText = "Stop monitoring and quit?"
            alert.informativeText = quitSummary(latestStatus)
            alert.addButton(withTitle: "Keep Monitoring"); alert.addButton(withTitle: "Stop & Quit")
            if alert.runModal() == .alertSecondButtonReturn { stopAndQuit() }
        } else { stopAndQuit() }
    }

    private func quitSummary(_ status: [String: Any]) -> String {
        let observed = status["observed_seconds"] as? Double ?? 0
        let active = status["active_seconds"] as? Double ?? 0
        let overhead = status["overhead"] as? [String: Any] ?? [:]
        let cpu = overhead["current_cpu_percent"] as? Double
        let memory = overhead["current_memory_bytes"] as? Double ?? 0
        let history = overhead["history_bytes"] as? Double ?? 0
        return String(format: "Observed %.0fs · AI active %.0fs\nForkit %.1f%% CPU · %.1f MB RAM · %.1f KB history", observed, active, cpu ?? 0, memory / 1_000_000, history / 1_000)
    }

    private func stopAndQuit() {
        guard !shuttingDown else { return }; shuttingDown = true; statusTimer?.invalidate(); statusTimer = nil
        finishTermination()
    }

    private func finishTermination() {
        guard shuttingDown else { return }
        outputPipe = nil
        if let process = nodeProcess, process.isRunning {
            process.terminationHandler = nil
            process.terminate()
            let deadline = Date().addingTimeInterval(1)
            while process.isRunning && Date() < deadline {
                RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.02))
            }
            if process.isRunning { Darwin.kill(process.processIdentifier, SIGKILL) }
        }
        nodeProcess = nil
        exit(0)
    }

    private func serviceTerminated(_ status: Int32) {
        nodeProcess = nil
        if shuttingDown { finishTermination(); return }
        statusLine?.title = "Service stopped"
        showFatalError("The local service stopped unexpectedly. No monitoring remains active.")
    }

    private func showFatalError(_ message: String) {
        let alert = NSAlert(); alert.messageText = "Forkit AI Footprints"; alert.informativeText = message; alert.addButton(withTitle: "Quit"); alert.runModal()
        shuttingDown = true; finishTermination()
    }

    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        if shuttingDown { return .terminateNow }
        requestQuit(); return .terminateCancel
    }
}

@MainActor private var retainedAppDelegate: FootprintsAppDelegate?

private func runAppAttestAndExit(_ arguments: [String]) async {
    do { try await runAppAttestCommand(arguments); exit(0) }
    catch LauncherError.appAttestUnavailable { emit(["ok": false, "code": "APP_ATTEST_UNAVAILABLE", "network_request_made": false]); exit(2) }
    catch LauncherError.invalidHash { emit(["ok": false, "code": "INVALID_APP_ATTEST_INPUT", "network_request_made": false]); exit(2) }
    catch LauncherError.keyMissing { emit(["ok": false, "code": "APP_ATTEST_KEY_MISSING", "network_request_made": false]); exit(2) }
    catch { emit(["ok": false, "code": "APP_ATTEST_OPERATION_FAILED", "network_request_made": false]); exit(1) }
}

@main
private struct ForkitAiFootprintsLauncher {
    @MainActor static func main() {
        let arguments = Array(CommandLine.arguments.dropFirst())
        if arguments.first == "--app-attest" {
            Task { await runAppAttestAndExit(Array(arguments.dropFirst())) }
            RunLoop.main.run()
            return
        }
        let application = NSApplication.shared
        let delegate = FootprintsAppDelegate(arguments: arguments)
        application.delegate = delegate
        retainedAppDelegate = delegate
        application.run()
    }
}
