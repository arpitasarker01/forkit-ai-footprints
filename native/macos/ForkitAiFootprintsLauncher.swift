import CryptoKit
import DeviceCheck
import Foundation
import Security

private let keychainService = "dev.forkit.ai-footprints.app-attest"
private let keychainAccount = "verified-installation"

private enum LauncherError: Error {
    case appAttestUnavailable
    case invalidHash
    case keyMissing
    case keychain(OSStatus)
    case resourceMissing
}

private func emit(_ value: [String: Any]) {
    guard let data = try? JSONSerialization.data(withJSONObject: value, options: [.sortedKeys]),
          let line = String(data: data, encoding: .utf8) else {
        FileHandle.standardOutput.write(Data("{\"ok\":false,\"code\":\"JSON_ENCODING_FAILED\"}\n".utf8))
        return
    }
    FileHandle.standardOutput.write(Data("\(line)\n".utf8))
}

private func base64url(_ data: Data) -> String {
    data.base64EncodedString()
        .replacingOccurrences(of: "+", with: "-")
        .replacingOccurrences(of: "/", with: "_")
        .replacingOccurrences(of: "=", with: "")
}

private func dataFromHex(_ value: String) throws -> Data {
    guard value.count == 64, value.allSatisfy({ $0.isHexDigit }) else { throw LauncherError.invalidHash }
    var bytes = Data(capacity: 32)
    var index = value.startIndex
    for _ in 0..<32 {
        let next = value.index(index, offsetBy: 2)
        guard let byte = UInt8(value[index..<next], radix: 16) else { throw LauncherError.invalidHash }
        bytes.append(byte)
        index = next
    }
    return bytes
}

private func storedKeyId() throws -> String? {
    let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: keychainService,
        kSecAttrAccount as String: keychainAccount,
        kSecReturnData as String: true,
        kSecMatchLimit as String: kSecMatchLimitOne,
    ]
    var result: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &result)
    if status == errSecItemNotFound { return nil }
    guard status == errSecSuccess, let data = result as? Data,
          let keyId = String(data: data, encoding: .utf8) else { throw LauncherError.keychain(status) }
    return keyId
}

private func storeKeyId(_ keyId: String) throws {
    let keyData = Data(keyId.utf8)
    let lookup: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: keychainService,
        kSecAttrAccount as String: keychainAccount,
    ]
    let updateStatus = SecItemUpdate(lookup as CFDictionary, [kSecValueData as String: keyData] as CFDictionary)
    if updateStatus == errSecSuccess { return }
    guard updateStatus == errSecItemNotFound else { throw LauncherError.keychain(updateStatus) }
    var addition = lookup
    addition[kSecValueData as String] = keyData
    addition[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
    let addStatus = SecItemAdd(addition as CFDictionary, nil)
    guard addStatus == errSecSuccess else { throw LauncherError.keychain(addStatus) }
}

private func capability() -> [String: Any] {
    let os = ProcessInfo.processInfo.operatingSystemVersion
    let supported = DCAppAttestService.shared.isSupported
    return [
        "schema_version": "1.0",
        "platform": "darwin",
        "os_major": os.majorVersion,
        "app_attest_supported": supported,
        "ready_for_verified_global": supported,
        "network_request_made": false,
    ]
}

private func requireSupported() throws -> DCAppAttestService {
    let service = DCAppAttestService.shared
    guard service.isSupported else { throw LauncherError.appAttestUnavailable }
    return service
}

private func runAppAttestCommand(_ arguments: [String]) async throws {
    guard let command = arguments.first else { emit(capability()); return }
    if command == "status" { emit(capability()); return }
    let service = try requireSupported()
    if command == "generate-key" {
        if let existing = try storedKeyId() {
            emit(["ok": true, "key_id": existing, "reused": true])
            return
        }
        let keyId = try await service.generateKey()
        try storeKeyId(keyId)
        emit(["ok": true, "key_id": keyId, "reused": false])
        return
    }
    guard arguments.count == 2 else { throw LauncherError.invalidHash }
    let clientDataHash = try dataFromHex(arguments[1])
    guard let keyId = try storedKeyId() else { throw LauncherError.keyMissing }
    if command == "attest" {
        let object = try await service.attestKey(keyId, clientDataHash: clientDataHash)
        emit(["ok": true, "key_id": keyId, "attestation": base64url(object)])
        return
    }
    if command == "assert" {
        let object = try await service.generateAssertion(keyId, clientDataHash: clientDataHash)
        emit(["ok": true, "key_id": keyId, "assertion": base64url(object)])
        return
    }
    throw LauncherError.invalidHash
}

private func runLocalApp(_ arguments: [String]) throws -> Int32 {
    guard let resources = Bundle.main.resourceURL else { throw LauncherError.resourceMissing }
    let process = Process()
    process.executableURL = resources.appendingPathComponent("runtime/node")
    process.arguments = [resources.appendingPathComponent("app/dist/cli.js").path, "serve"] + arguments
    var environment = ProcessInfo.processInfo.environment
    environment["FORKIT_AI_FOOTPRINTS_APP_BUNDLE"] = "1"
    process.environment = environment
    process.standardOutput = FileHandle.standardOutput
    process.standardError = FileHandle.standardError
    try process.run()
    process.waitUntilExit()
    return process.terminationStatus
}

@main
private struct ForkitAiFootprintsLauncher {
    static func main() async {
        do {
            let arguments = Array(CommandLine.arguments.dropFirst())
            if arguments.first == "--app-attest" {
                try await runAppAttestCommand(Array(arguments.dropFirst()))
                return
            }
            exit(try runLocalApp(arguments))
        } catch LauncherError.appAttestUnavailable {
            emit(["ok": false, "code": "APP_ATTEST_UNAVAILABLE", "network_request_made": false])
            exit(2)
        } catch LauncherError.invalidHash {
            emit(["ok": false, "code": "INVALID_APP_ATTEST_INPUT", "network_request_made": false])
            exit(2)
        } catch LauncherError.keyMissing {
            emit(["ok": false, "code": "APP_ATTEST_KEY_MISSING", "network_request_made": false])
            exit(2)
        } catch {
            emit(["ok": false, "code": "APP_ATTEST_OPERATION_FAILED", "network_request_made": false])
            exit(1)
        }
    }
}
