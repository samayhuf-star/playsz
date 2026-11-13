import XCTest

/// StoreKit Testing only applies to processes started by Xcode / xcodebuild test.
/// This UI test launches Playsz that way, then does Restore and a yearly test purchase.
final class PurchaseRestoreTests: XCTestCase {
  var app: XCUIApplication!

  override func setUpWithError() throws {
    continueAfterFailure = false
    app = XCUIApplication()
    app.launchArguments += ["-playsz-storekit-uitest"]
    app.launch()
  }

  func testRestoreThenYearlyPurchase() throws {
    let unlock = element("library-paywall-button")
    XCTAssertTrue(unlock.waitForExistence(timeout: 45), "Library Unlock Pro button did not appear")
    unlock.tap()

    XCTAssertTrue(element("paywall-screen").waitForExistence(timeout: 25), "Paywall did not open")

    let restore = element("paywall-restore")
    XCTAssertTrue(restore.waitForExistence(timeout: 10), "Restore control missing")
    restore.tap()

    let restoreMessage = app.staticTexts.matching(
      NSPredicate(format: "label MATCHES %@", ".*(Pro is unlocked|Purchases restored|No Pro purchase was found).*")
    ).firstMatch
    XCTAssertTrue(restoreMessage.waitForExistence(timeout: 20), "Restore did not show a result message")
    writeShot("05-restore.png")

    // If Restore already unlocked Pro (a leftover transaction), the buy button is gone.
    if element("paywall-unlocked").waitForExistence(timeout: 3) {
      writeShot("04-purchase.png")
      return
    }

    let yearly = element("paywall-plan-playsz_pro_yearly")
    XCTAssertTrue(yearly.waitForExistence(timeout: 10), "Yearly plan missing")
    yearly.tap()

    let buy = element("paywall-buy")
    XCTAssertTrue(buy.waitForExistence(timeout: 10), "Buy button missing")
    buy.tap()

    confirmStoreKitSheet()

    XCTAssertTrue(element("paywall-unlocked").waitForExistence(timeout: 25), "Yearly test purchase did not unlock Pro")
    writeShot("04-purchase.png")
  }

  private func element(_ id: String) -> XCUIElement {
    app.descendants(matching: .any).matching(identifier: id).firstMatch
  }

  private func confirmStoreKitSheet() {
    let labels = ["Subscribe", "Purchase", "Buy", "Confirm", "OK"]
    for _ in 0..<8 {
      if element("paywall-unlocked").exists { return }
      for label in labels {
        let button = app.buttons[label]
        if button.waitForExistence(timeout: 1) {
          button.tap()
          break
        }
      }
    }
  }

  private func writeShot(_ name: String) {
    let out = ProcessInfo.processInfo.environment["QA_ARTIFACTS"]
      ?? ProcessInfo.processInfo.environment["OUT"]
      ?? ""
    guard !out.isEmpty else { return }
    let dir = URL(fileURLWithPath: out).appendingPathComponent("screenshots", isDirectory: true)
    try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    let url = dir.appendingPathComponent(name)
    try? app.screenshot().pngRepresentation.write(to: url)
  }
}
