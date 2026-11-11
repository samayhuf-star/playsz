import AVFoundation
import CommonCrypto
import CryptoKit
import ExpoModulesCore
import Foundation

public class PlayszNativeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PlayszNative")

    AsyncFunction("exportAudioToM4a") { (sourceUri: String, destPath: String) -> String in
      try await self.exportAudioToM4a(sourceUri: sourceUri, destPath: Self.stripFileScheme(destPath))
    }

    AsyncFunction("exportEncryptedArchive") { (sourceDir: String, destPath: String, password: String) -> String in
      try self.exportEncryptedArchive(
        sourceDir: Self.stripFileScheme(sourceDir),
        destPath: Self.stripFileScheme(destPath),
        password: password
      )
    }

    AsyncFunction("importEncryptedArchive") { (archivePath: String, destDir: String, password: String) -> Int in
      try self.importEncryptedArchive(
        archivePath: Self.stripFileScheme(archivePath),
        destDir: Self.stripFileScheme(destDir),
        password: password
      )
    }
  }

  private func exportAudioToM4a(sourceUri: String, destPath: String) async throws -> String {
    guard let sourceURL = Self.url(from: sourceUri) else {
      throw Exception(name: "PlayszNative", description: "Could not open the selected video.")
    }
    let destURL = URL(fileURLWithPath: destPath)
    try FileManager.default.createDirectory(
      at: destURL.deletingLastPathComponent(),
      withIntermediateDirectories: true
    )
    if FileManager.default.fileExists(atPath: destURL.path) {
      try FileManager.default.removeItem(at: destURL)
    }

    let asset = AVURLAsset(url: sourceURL)
    let audioTracks = try await asset.loadTracks(withMediaType: .audio)
    if audioTracks.isEmpty {
      throw Exception(name: "PlayszNative", description: "This video has no audio track to export.")
    }

    guard let session = AVAssetExportSession(asset: asset, presetName: AVAssetExportPresetAppleM4A) else {
      throw Exception(name: "PlayszNative", description: "This device cannot export audio to M4A.")
    }
    session.outputFileType = .m4a
    session.outputURL = destURL

    await session.export()
    if session.status != .completed {
      let message = session.error?.localizedDescription ?? "The audio export failed."
      throw Exception(name: "PlayszNative", description: message)
    }
    return destURL.path
  }

  private func exportEncryptedArchive(sourceDir: String, destPath: String, password: String) throws -> String {
    if password.isEmpty {
      throw Exception(name: "PlayszNative", description: "A password is required to create an encrypted archive.")
    }
    let dirURL = URL(fileURLWithPath: sourceDir, isDirectory: true)
    let entries = try FileManager.default.contentsOfDirectory(at: dirURL, includingPropertiesForKeys: nil)
      .filter { url in
        var isDir: ObjCBool = false
        FileManager.default.fileExists(atPath: url.path, isDirectory: &isDir)
        return !isDir.boolValue && url.lastPathComponent != "manifest.json"
      }
    if entries.isEmpty {
      throw Exception(name: "PlayszNative", description: "The private folder is empty.")
    }

    let destURL = URL(fileURLWithPath: destPath)
    try FileManager.default.createDirectory(
      at: destURL.deletingLastPathComponent(),
      withIntermediateDirectories: true
    )
    if FileManager.default.fileExists(atPath: destURL.path) {
      try FileManager.default.removeItem(at: destURL)
    }

    var salt = Data(count: 16)
    salt.withUnsafeMutableBytes { buf in
      _ = SecRandomCopyBytes(kSecRandomDefault, 16, buf.baseAddress!)
    }
    let key = try Self.deriveKey(password: password, salt: salt, iterations: Self.kdfIterations)

    FileManager.default.createFile(atPath: destURL.path, contents: nil)
    let handle = try FileHandle(forWritingTo: destURL)
    defer { try? handle.close() }

    try handle.write(contentsOf: Data(Self.magic))
    try handle.write(contentsOf: salt)
    try handle.write(contentsOf: Self.be32(UInt32(Self.kdfIterations)))
    try handle.write(contentsOf: Self.be32(UInt32(entries.count)))

    for fileURL in entries {
      let nameData = Data(fileURL.lastPathComponent.utf8)
      let attrs = try FileManager.default.attributesOfItem(atPath: fileURL.path)
      let size = (attrs[.size] as? NSNumber)?.uint64Value ?? 0
      try handle.write(contentsOf: Self.be32(UInt32(nameData.count)))
      try handle.write(contentsOf: nameData)
      try handle.write(contentsOf: Self.be64(size))
      try Self.encryptFileInChunks(from: fileURL, key: key, to: handle)
    }
    return destURL.path
  }

  private func importEncryptedArchive(archivePath: String, destDir: String, password: String) throws -> Int {
    if password.isEmpty {
      throw Exception(name: "PlayszNative", description: "A password is required to open an encrypted archive.")
    }
    let archiveURL = URL(fileURLWithPath: archivePath)
    let destURL = URL(fileURLWithPath: destDir, isDirectory: true)
    try FileManager.default.createDirectory(at: destURL, withIntermediateDirectories: true)

    let data = try Data(contentsOf: archiveURL)
    var offset = 0
    func require(_ count: Int) throws -> Data {
      if offset + count > data.count {
        throw Exception(name: "PlayszNative", description: "The archive is corrupt or the password is wrong.")
      }
      let slice = data.subdata(in: offset..<(offset + count))
      offset += count
      return slice
    }

    let magic = try require(Self.magic.count)
    if magic != Data(Self.magic) {
      throw Exception(name: "PlayszNative", description: "This file is not a Playsz encrypted archive.")
    }
    let salt = try require(16)
    let iterations = try Self.readU32(require(4))
    if iterations == 0 || iterations > 5_000_000 {
      throw Exception(name: "PlayszNative", description: "The archive header is invalid.")
    }
    let key = try Self.deriveKey(password: password, salt: salt, iterations: Int(iterations))
    let count = try Self.readU32(require(4))
    if count > 10_000 {
      throw Exception(name: "PlayszNative", description: "The archive header is invalid.")
    }

    do {
      for _ in 0..<count {
        let nameLen = try Self.readU32(require(4))
        if nameLen == 0 || nameLen > 1024 {
          throw Exception(name: "PlayszNative", description: "The archive is corrupt or the password is wrong.")
        }
        let nameData = try require(Int(nameLen))
        guard let name = String(data: nameData, encoding: .utf8),
              !name.contains(".."), !name.contains("/"), !name.contains("\\") else {
          throw Exception(name: "PlayszNative", description: "The archive contains an invalid file name.")
        }
        _ = try require(8) // original size
        let outURL = destURL.appendingPathComponent(name)
        try Self.decryptFileInChunks(from: data, offset: &offset, key: key, to: outURL)
      }
    } catch {
      try? FileManager.default.removeItem(at: destURL)
      try FileManager.default.createDirectory(at: destURL, withIntermediateDirectories: true)
      throw Exception(name: "PlayszNative", description: "Could not decrypt the archive. Check the password and try again.")
    }
    return Int(count)
  }

  private static func encryptFileInChunks(from fileURL: URL, key: SymmetricKey, to handle: FileHandle) throws {
    let input = try FileHandle(forReadingFrom: fileURL)
    defer { try? input.close() }
    while true {
      let chunk = try input.read(upToCount: chunkSize) ?? Data()
      if chunk.isEmpty {
        break
      }
      var iv = Data(count: 12)
      iv.withUnsafeMutableBytes { buf in
        _ = SecRandomCopyBytes(kSecRandomDefault, 12, buf.baseAddress!)
      }
      let nonce = try AES.GCM.Nonce(data: iv)
      let sealed = try AES.GCM.seal(chunk, using: key, nonce: nonce)
      guard let combined = sealed.combined else {
        throw Exception(name: "PlayszNative", description: "Encryption failed.")
      }
      // combined is nonce + ciphertext + tag; we already wrote iv separately, so drop the nonce prefix
      let cipher = combined.dropFirst(12)
      try handle.write(contentsOf: iv)
      try handle.write(contentsOf: be32(UInt32(cipher.count)))
      try handle.write(contentsOf: cipher)
    }
    try handle.write(contentsOf: Data(count: 12))
    try handle.write(contentsOf: be32(0))
  }

  private static func decryptFileInChunks(from data: Data, offset: inout Int, key: SymmetricKey, to dest: URL) throws {
    func require(_ count: Int) throws -> Data {
      if offset + count > data.count {
        throw Exception(name: "PlayszNative", description: "invalid chunk")
      }
      let slice = data.subdata(in: offset..<(offset + count))
      offset += count
      return slice
    }
    if FileManager.default.fileExists(atPath: dest.path) {
      try FileManager.default.removeItem(at: dest)
    }
    FileManager.default.createFile(atPath: dest.path, contents: nil)
    let out = try FileHandle(forWritingTo: dest)
    defer { try? out.close() }

    while true {
      let iv = try require(12)
      let cipherLen = try readU32(require(4))
      if cipherLen == 0 {
        break
      }
      if cipherLen < 16 || cipherLen > UInt32(chunkSize + 32) {
        throw Exception(name: "PlayszNative", description: "invalid chunk")
      }
      let cipher = try require(Int(cipherLen))
      let nonce = try AES.GCM.Nonce(data: iv)
      // sealed box combined format is nonce + ciphertext + tag
      let combined = iv + cipher
      let box = try AES.GCM.SealedBox(combined: combined)
      let plain = try AES.GCM.open(box, using: key)
      try out.write(contentsOf: plain)
    }
  }

  private static func deriveKey(password: String, salt: Data, iterations: Int) throws -> SymmetricKey {
    let passwordData = Data(password.utf8)
    var derived = Data(count: 32)
    let status = derived.withUnsafeMutableBytes { derivedBytes in
      salt.withUnsafeBytes { saltBytes in
        passwordData.withUnsafeBytes { passBytes in
          CCKeyDerivationPBKDF(
            CCPBKDFAlgorithm(kCCPBKDF2),
            passBytes.bindMemory(to: CChar.self).baseAddress,
            passwordData.count,
            saltBytes.bindMemory(to: UInt8.self).baseAddress,
            salt.count,
            CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA1),
            UInt32(iterations),
            derivedBytes.bindMemory(to: UInt8.self).baseAddress,
            32
          )
        }
      }
    }
    if status != kCCSuccess {
      throw Exception(name: "PlayszNative", description: "Could not derive an encryption key.")
    }
    return SymmetricKey(data: derived)
  }

  private static func url(from value: String) -> URL? {
    if value.hasPrefix("file://") || value.hasPrefix("content://") || value.hasPrefix("ph://") || value.hasPrefix("assets-library://") {
      return URL(string: value)
    }
    return URL(fileURLWithPath: stripFileScheme(value))
  }

  private static func stripFileScheme(_ path: String) -> String {
    if path.hasPrefix("file://") {
      return URL(string: path)?.path ?? String(path.dropFirst("file://".count))
    }
    return path
  }

  private static func be32(_ value: UInt32) -> Data {
    var v = value.bigEndian
    return Data(bytes: &v, count: 4)
  }

  private static func be64(_ value: UInt64) -> Data {
    var v = value.bigEndian
    return Data(bytes: &v, count: 8)
  }

  private static func readU32(_ data: Data) -> UInt32 {
    var value: UInt32 = 0
    _ = withUnsafeMutableBytes(of: &value) { buf in
      data.copyBytes(to: buf)
    }
    return UInt32(bigEndian: value)
  }

  private static let magic: [UInt8] = [0x50, 0x4C, 0x41, 0x59, 0x53, 0x5A, 0x31, 0x0A]
  private static let kdfIterations = 120_000
  private static let chunkSize = 1024 * 1024
}
