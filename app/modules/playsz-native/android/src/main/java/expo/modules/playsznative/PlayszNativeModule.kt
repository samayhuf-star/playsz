package expo.modules.playsznative

import android.content.Context
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaMuxer
import android.net.Uri
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.nio.ByteBuffer
import java.nio.charset.StandardCharsets
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec

class PlayszNativeModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("PlayszNative")

    AsyncFunction("exportAudioToM4a") { sourceUri: String, destPath: String ->
      exportAudioToM4a(sourceUri, stripFileScheme(destPath))
    }

    AsyncFunction("exportEncryptedArchive") { sourceDir: String, destPath: String, password: String ->
      exportEncryptedArchive(stripFileScheme(sourceDir), stripFileScheme(destPath), password)
    }

    AsyncFunction("importEncryptedArchive") { archivePath: String, destDir: String, password: String ->
      importEncryptedArchive(stripFileScheme(archivePath), stripFileScheme(destDir), password)
    }
  }

  private fun exportAudioToM4a(sourceUri: String, destPath: String): String {
    val dest = File(destPath)
    dest.parentFile?.mkdirs()
    if (dest.exists()) {
      dest.delete()
    }

    val extractor = MediaExtractor()
    try {
      setDataSource(extractor, sourceUri)
      val audioTrack = findAudioTrack(extractor)
        ?: throw Exception("This video has no audio track to export.")
      extractor.selectTrack(audioTrack)
      val format = extractor.getTrackFormat(audioTrack)
      val mime = format.getString(android.media.MediaFormat.KEY_MIME) ?: ""
      if (!mime.contains("mp4a") && mime != "audio/mp4a-latm") {
        throw Exception(
          "This video's audio is $mime, which cannot be remuxed to M4A on this device. Only AAC audio can be exported."
        )
      }

      val muxer = MediaMuxer(dest.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
      try {
        val muxerTrack = muxer.addTrack(format)
        muxer.start()
        val buffer = ByteBuffer.allocate(256 * 1024)
        val info = MediaCodec.BufferInfo()
        while (true) {
          val size = extractor.readSampleData(buffer, 0)
          if (size < 0) {
            break
          }
          info.offset = 0
          info.size = size
          info.presentationTimeUs = extractor.sampleTime
          info.flags = extractor.sampleFlags
          muxer.writeSampleData(muxerTrack, buffer, info)
          extractor.advance()
        }
        muxer.stop()
      } catch (err: Exception) {
        try {
          muxer.release()
        } catch (_: Exception) {
        }
        dest.delete()
        throw Exception(
          err.message
            ?: "Could not remux this audio to M4A. Only AAC audio tracks can be exported on Android."
        )
      }
      muxer.release()
    } finally {
      extractor.release()
    }

    if (!dest.exists() || dest.length() == 0L) {
      dest.delete()
      throw Exception("The audio export did not produce a file.")
    }
    return dest.absolutePath
  }

  private fun findAudioTrack(extractor: MediaExtractor): Int? {
    for (i in 0 until extractor.trackCount) {
      val mime = extractor.getTrackFormat(i).getString(android.media.MediaFormat.KEY_MIME) ?: ""
      if (mime.startsWith("audio/")) {
        return i
      }
    }
    return null
  }

  private fun setDataSource(extractor: MediaExtractor, sourceUri: String) {
    if (sourceUri.startsWith("content://")) {
      val afd = context.contentResolver.openAssetFileDescriptor(Uri.parse(sourceUri), "r")
        ?: throw Exception("Could not open the selected video.")
      afd.use {
        extractor.setDataSource(it.fileDescriptor, it.startOffset, it.length)
      }
      return
    }
    val path = stripFileScheme(sourceUri)
    extractor.setDataSource(path)
  }

  private fun exportEncryptedArchive(sourceDir: String, destPath: String, password: String): String {
    if (password.isEmpty()) {
      throw Exception("A password is required to create an encrypted archive.")
    }
    val dir = File(sourceDir)
    if (!dir.isDirectory) {
      throw Exception("The private folder could not be found.")
    }
    val files = dir.listFiles()?.filter { it.isFile && it.name != "manifest.json" } ?: emptyList()
    if (files.isEmpty()) {
      throw Exception("The private folder is empty.")
    }

    val dest = File(destPath)
    dest.parentFile?.mkdirs()
    if (dest.exists()) {
      dest.delete()
    }

    val salt = ByteArray(16)
    SecureRandom().nextBytes(salt)
    val key = deriveKey(password, salt)

    DataOutputStream(BufferedOutputStream(FileOutputStream(dest))).use { out ->
      out.write(MAGIC)
      out.write(salt)
      out.writeInt(KDF_ITERATIONS)
      out.writeInt(files.size)
      for (file in files) {
        val nameBytes = file.name.toByteArray(StandardCharsets.UTF_8)
        out.writeInt(nameBytes.size)
        out.write(nameBytes)
        out.writeLong(file.length())
        encryptFileInChunks(file, key, out)
      }
    }
    return dest.absolutePath
  }

  private fun importEncryptedArchive(archivePath: String, destDirPath: String, password: String): Int {
    if (password.isEmpty()) {
      throw Exception("A password is required to open an encrypted archive.")
    }
    val archive = File(archivePath)
    if (!archive.isFile) {
      throw Exception("The archive file could not be found.")
    }
    val destDir = File(destDirPath)
    destDir.mkdirs()

    DataInputStream(BufferedInputStream(FileInputStream(archive))).use { input ->
      val magic = ByteArray(MAGIC.size)
      input.readFully(magic)
      if (!magic.contentEquals(MAGIC)) {
        throw Exception("This file is not a Playsz encrypted archive.")
      }
      val salt = ByteArray(16)
      input.readFully(salt)
      val iterations = input.readInt()
      if (iterations <= 0 || iterations > 5_000_000) {
        throw Exception("The archive header is invalid.")
      }
      val key = deriveKey(password, salt, iterations)
      val count = input.readInt()
      if (count < 0 || count > 10_000) {
        throw Exception("The archive header is invalid.")
      }
      try {
        for (i in 0 until count) {
          val nameLen = input.readInt()
          if (nameLen <= 0 || nameLen > 1024) {
            throw Exception("The archive is corrupt or the password is wrong.")
          }
          val nameBytes = ByteArray(nameLen)
          input.readFully(nameBytes)
          val name = String(nameBytes, StandardCharsets.UTF_8)
          if (name.contains("..") || name.contains('/') || name.contains('\\')) {
            throw Exception("The archive contains an invalid file name.")
          }
          input.readLong() // original size, unused
          val outFile = File(destDir, name)
          decryptFileInChunks(input, key, outFile)
        }
      } catch (err: Exception) {
        destDir.listFiles()?.forEach { it.delete() }
        throw Exception("Could not decrypt the archive. Check the password and try again.")
      }
      return count
    }
  }

  private fun encryptFileInChunks(file: File, key: SecretKeySpec, out: DataOutputStream) {
    FileInputStream(file).use { input ->
      val plain = ByteArray(CHUNK_SIZE)
      while (true) {
        val read = input.read(plain)
        if (read <= 0) {
          break
        }
        val iv = ByteArray(12)
        SecureRandom().nextBytes(iv)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key, GCMParameterSpec(128, iv))
        val encrypted = cipher.doFinal(plain, 0, read)
        out.write(iv)
        out.writeInt(encrypted.size)
        out.write(encrypted)
      }
    }
    out.write(ByteArray(12))
    out.writeInt(0)
  }

  private fun decryptFileInChunks(input: DataInputStream, key: SecretKeySpec, dest: File) {
    FileOutputStream(dest).use { output ->
      while (true) {
        val iv = ByteArray(12)
        input.readFully(iv)
        val cipherLen = input.readInt()
        if (cipherLen == 0) {
          break
        }
        if (cipherLen < 16 || cipherLen > CHUNK_SIZE + 32) {
          throw Exception("invalid chunk")
        }
        val encrypted = ByteArray(cipherLen)
        input.readFully(encrypted)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(128, iv))
        val plain = cipher.doFinal(encrypted)
        output.write(plain)
      }
    }
  }

  private fun deriveKey(password: String, salt: ByteArray, iterations: Int = KDF_ITERATIONS): SecretKeySpec {
    val factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA1")
    val spec = PBEKeySpec(password.toCharArray(), salt, iterations, 256)
    val bytes = factory.generateSecret(spec).encoded
    return SecretKeySpec(bytes, "AES")
  }

  private fun stripFileScheme(path: String): String {
    return if (path.startsWith("file://")) path.removePrefix("file://") else path
  }

  companion object {
    private val MAGIC = byteArrayOf('P'.code.toByte(), 'L'.code.toByte(), 'A'.code.toByte(), 'Y'.code.toByte(), 'S'.code.toByte(), 'Z'.code.toByte(), '1'.code.toByte(), '\n'.code.toByte())
    private const val KDF_ITERATIONS = 120_000
    private const val CHUNK_SIZE = 1024 * 1024
  }
}
