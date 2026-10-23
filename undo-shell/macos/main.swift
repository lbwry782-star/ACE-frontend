import Cocoa
import Darwin
import Foundation
import WebKit

private let mutexPath = "/tmp/ACE-UNDO-SHELL.lock"
private let compactSize = NSSize(width: 420, height: 104)

final class UndoAppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKScriptMessageHandler, WKUIDelegate {
    private let startURL: URL
    private var window: NSWindow!
    private var webView: WKWebView!
    private var lockFile: FileHandle?

    init(startURL: URL) {
        self.startURL = startURL
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        if !claimSingleInstance() {
            activateExistingInstance()
            NSApp.terminate(nil)
            return
        }

        let config = WKWebViewConfiguration()
        config.userContentController.add(self, name: "aceUndo")

        webView = WKWebView(frame: NSRect(origin: .zero, size: compactSize), configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = false
        webView.allowsMagnification = false
        if #available(macOS 12.0, *) {
            webView.underPageBackgroundColor = .windowBackgroundColor
        }

        window = NSWindow(
            contentRect: NSRect(x: 80, y: 80, width: compactSize.width, height: compactSize.height),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "UNDO"
        window.minSize = NSSize(width: 360, height: 96)
        window.isReleasedWhenClosed = false
        window.level = .normal
        window.backgroundColor = .windowBackgroundColor
        window.contentView = webView
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        webView.load(URLRequest(url: startURL))
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        window?.makeKeyAndOrderFront(nil)
        return true
    }

    func applicationWillTerminate(_ notification: Notification) {
        lockFile?.closeFile()
        try? FileManager.default.removeItem(atPath: mutexPath)
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "aceUndo" else { return }
        guard let json = message.body as? String,
              json.contains("ace-undo-resize") else { return }
        let width = readJSONInt(json, name: "width", fallback: 420)
        let height = readJSONInt(json, name: "height", fallback: 104)
        applyContentSize(width: width, height: height)
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url, isAllowedLoopback(url) else {
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        return nil
    }

    private func applyContentSize(width: Int, height: Int) {
        guard let window else { return }
        if window.isMiniaturized { return }
        let clamped = NSSize(
            width: min(960, max(360, CGFloat(width))),
            height: min(900, max(96, CGFloat(height)))
        )
        window.setContentSize(clamped)
    }

    private func claimSingleInstance() -> Bool {
        FileManager.default.createFile(atPath: mutexPath, contents: nil)
        guard let handle = FileHandle(forWritingAtPath: mutexPath) else { return true }
        lockFile = handle
        let fd = handle.fileDescriptor
        return flock(fd, LOCK_EX | LOCK_NB) == 0
    }

    private func activateExistingInstance() {
        let others = NSWorkspace.shared.runningApplications.filter {
            $0.localizedName == "AceUndo" || $0.localizedName == "UNDO"
        }
        others.first?.activate(options: [.activateIgnoringOtherApps])
    }
}

private func isAllowedLoopback(_ url: URL) -> Bool {
    let scheme = url.scheme?.lowercased() ?? ""
    if scheme == "about" { return true }
    guard scheme == "http" || scheme == "https" || scheme == "ws" || scheme == "wss" else {
        return false
    }
    let host = (url.host ?? "").lowercased()
    return host == "127.0.0.1" || host == "localhost"
}

private func readJSONInt(_ json: String, name: String, fallback: Int) -> Int {
    guard let regex = try? NSRegularExpression(pattern: "\"\(name)\"\\s*:\\s*(\\d+)") else {
        return fallback
    }
    let range = NSRange(json.startIndex..<json.endIndex, in: json)
    guard let match = regex.firstMatch(in: json, range: range),
          let valueRange = Range(match.range(at: 1), in: json),
          let value = Int(json[valueRange]) else {
        return fallback
    }
    return value
}

private func parseURL(_ args: [String]) -> String? {
    if let index = args.firstIndex(of: "--url"), index + 1 < args.count {
        return args[index + 1]
    }
    return args.first { $0.hasPrefix("http://") || $0.hasPrefix("https://") }
}

private func validateStartURL(_ raw: String?) -> (URL?, String?) {
    guard let raw, let url = URL(string: raw) else {
        return (nil, "UNDO requires a local Vite URL. Start the frontend first, then run Start-AceUndoLocal.")
    }
    let scheme = url.scheme?.lowercased() ?? ""
    if scheme != "http" && scheme != "https" {
        return (nil, "UNDO accepts only http(s) loopback URLs.")
    }
    let host = (url.host ?? "").lowercased()
    if host != "127.0.0.1" && host != "localhost" {
        return (nil, "UNDO refuses non-loopback URLs.")
    }
    if !(url.fragment ?? "").contains("/local-undo") {
        return (nil, "UNDO loads only the local #/local-undo route.")
    }
    return (url, nil)
}

let parsed = validateStartURL(parseURL(Array(CommandLine.arguments.dropFirst())))
if let error = parsed.1 {
    fputs(error + "\n", stderr)
    exit(1)
}

let app = NSApplication.shared
let delegate = UndoAppDelegate(startURL: parsed.0!)
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
