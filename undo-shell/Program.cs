using System;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace AceUndo
{
    internal static class Native
    {
        public const int SW_RESTORE = 9;
        public const int DWMWA_USE_IMMERSIVE_DARK_MODE = 20;

        [DllImport("user32.dll")]
        public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

        [DllImport("user32.dll")]
        public static extern bool SetForegroundWindow(IntPtr hWnd);

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);

        [DllImport("dwmapi.dll")]
        public static extern int DwmSetWindowAttribute(
            IntPtr hwnd,
            int attr,
            ref int attrValue,
            int attrSize);
    }

    internal sealed class UndoForm : Form
    {
        private readonly string _startUrl;
        private readonly WebView2 _webView;
        private bool _restorePending;

        public UndoForm(string startUrl)
        {
            _startUrl = startUrl;
            Text = "UNDO";
            Name = "AceUndoForm";
            StartPosition = FormStartPosition.Manual;
            Location = new Point(24, 24);
            ClientSize = new Size(420, 104);
            MinimumSize = new Size(360, 96);
            MaximizeBox = true;
            MinimizeBox = true;
            ControlBox = true;
            ShowInTaskbar = true;
            TopMost = false;
            FormBorderStyle = FormBorderStyle.Sizable;
            ShowIcon = true;
            BackColor = SystemColors.Window;

            _webView = new WebView2
            {
                Dock = DockStyle.Fill,
                AllowExternalDrop = false,
                TabStop = true,
                DefaultBackgroundColor = Color.FromArgb(0, 0, 0, 0)
            };
            Controls.Add(_webView);
            Load += OnLoad;
            HandleCreated += OnHandleCreated;
            Activated += OnActivated;
            Resize += OnFormResize;
        }

        private void OnHandleCreated(object sender, EventArgs e)
        {
            int dark = IsAppsLightTheme() ? 0 : 1;
            Native.DwmSetWindowAttribute(
                Handle,
                Native.DWMWA_USE_IMMERSIVE_DARK_MODE,
                ref dark,
                sizeof(int));
        }

        private static bool IsAppsLightTheme()
        {
            try
            {
                using (RegistryKey key = Registry.CurrentUser.OpenSubKey(
                    @"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize"))
                {
                    object value = key == null ? null : key.GetValue("AppsUseLightTheme");
                    if (value is int)
                    {
                        return (int)value != 0;
                    }
                }
            }
            catch
            {
                /* fall through to system window color */
            }
            return SystemColors.Window.GetBrightness() > 0.5f;
        }

        private void OnActivated(object sender, EventArgs e)
        {
            if (_restorePending && WindowState != FormWindowState.Minimized)
            {
                BeginInvoke(new Action(RestoreWebView));
            }
        }

        private void OnFormResize(object sender, EventArgs e)
        {
            if (WindowState == FormWindowState.Minimized)
            {
                _restorePending = true;
                return;
            }
            if (_restorePending)
            {
                BeginInvoke(new Action(RestoreWebView));
            }
        }

        private void RestoreWebView()
        {
            if (!_restorePending || _webView == null || WindowState == FormWindowState.Minimized)
            {
                return;
            }
            _restorePending = false;
            _webView.Visible = true;
            _webView.Dock = DockStyle.None;
            _webView.Bounds = ClientRectangle;
            _webView.Dock = DockStyle.Fill;
            _webView.Invalidate(true);
            if (_webView.CoreWebView2 != null)
            {
                try
                {
                    _webView.CoreWebView2.Resume();
                }
                catch
                {
                    /* Resume is a no-op if the view was not suspended. */
                }
                _webView.CoreWebView2.Reload();
            }
        }

        private async void OnLoad(object sender, EventArgs e)
        {
            try
            {
                string userData = System.IO.Path.Combine(
                    System.IO.Path.GetTempPath(),
                    "ACE-UNDO-WebView2");
                CoreWebView2Environment env = await CoreWebView2Environment.CreateAsync(null, userData);
                await _webView.EnsureCoreWebView2Async(env);
                ConfigureWebView();
                _webView.CoreWebView2.Navigate(_startUrl);
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    this,
                    "WebView2 failed to start.\n" + ex.Message,
                    "UNDO",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
                Close();
            }
        }

        private void ConfigureWebView()
        {
            _webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
            _webView.CoreWebView2.Settings.AreDevToolsEnabled = false;
            _webView.CoreWebView2.Settings.AreHostObjectsAllowed = false;
            _webView.CoreWebView2.Settings.IsGeneralAutofillEnabled = false;
            _webView.CoreWebView2.Settings.IsPasswordAutosaveEnabled = false;
            _webView.CoreWebView2.Settings.IsStatusBarEnabled = false;
            _webView.CoreWebView2.Settings.IsZoomControlEnabled = false;
            _webView.CoreWebView2.Settings.IsWebMessageEnabled = true;

            _webView.CoreWebView2.NavigationStarting += OnNavigationStarting;
            _webView.CoreWebView2.NewWindowRequested += OnNewWindowRequested;
            _webView.CoreWebView2.WebMessageReceived += OnWebMessageReceived;
        }

        private static bool IsAllowedLoopbackUrl(string raw)
        {
            Uri uri;
            if (!Uri.TryCreate(raw, UriKind.Absolute, out uri))
            {
                return false;
            }
            if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps && uri.Scheme != "ws" && uri.Scheme != "wss")
            {
                return false;
            }
            string host = (uri.Host ?? string.Empty).ToLowerInvariant();
            if (host != "127.0.0.1" && host != "localhost")
            {
                return false;
            }
            return true;
        }

        private void OnNavigationStarting(object sender, CoreWebView2NavigationStartingEventArgs e)
        {
            if (!IsAllowedLoopbackUrl(e.Uri))
            {
                e.Cancel = true;
            }
        }

        private void OnNewWindowRequested(object sender, CoreWebView2NewWindowRequestedEventArgs e)
        {
            e.Handled = true;
        }

        private void OnWebMessageReceived(object sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            try
            {
                string json = e.TryGetWebMessageAsString();
                if (string.IsNullOrWhiteSpace(json))
                {
                    json = e.WebMessageAsJson;
                }
                if (json.IndexOf("ace-undo-resize", StringComparison.Ordinal) < 0)
                {
                    return;
                }
                int width = ReadJsonInt(json, "width", 420);
                int height = ReadJsonInt(json, "height", 104);
                ApplyContentSize(width, height);
            }
            catch
            {
                /* ignore malformed host messages */
            }
        }

        private static int ReadJsonInt(string json, string name, int fallback)
        {
            Match match = Regex.Match(json, "\"" + name + "\"\\s*:\\s*(\\d+)");
            int value;
            if (match.Success && int.TryParse(match.Groups[1].Value, out value))
            {
                return value;
            }
            return fallback;
        }

        private void ApplyContentSize(int width, int height)
        {
            if (WindowState == FormWindowState.Minimized)
            {
                return;
            }
            width = Math.Max(360, Math.Min(960, width));
            height = Math.Max(96, Math.Min(900, height));
            Size border = Size.Subtract(Size, ClientSize);
            Size next = new Size(width + border.Width, height + border.Height);
            if (Size != next)
            {
                Size = next;
            }
        }
    }

    internal static class Program
    {
        private const string MutexName = @"Local\ACE-UNDO-SHELL";

        [STAThread]
        private static int Main(string[] args)
        {
            bool created;
            using (Mutex mutex = new Mutex(true, MutexName, out created))
            {
                if (!created)
                {
                    IntPtr existing = Native.FindWindow(null, "UNDO");
                    if (existing != IntPtr.Zero)
                    {
                        Native.ShowWindow(existing, Native.SW_RESTORE);
                        Native.SetForegroundWindow(existing);
                    }
                    return 0;
                }

                string url = ParseUrl(args);
                string error;
                if (!TryValidateStartUrl(url, out error))
                {
                    MessageBox.Show(error, "UNDO", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                    return 1;
                }

                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                Application.Run(new UndoForm(url));
                GC.KeepAlive(mutex);
                return 0;
            }
        }

        private static string ParseUrl(string[] args)
        {
            if (args == null)
            {
                return null;
            }
            for (int i = 0; i < args.Length; i++)
            {
                if (string.Equals(args[i], "--url", StringComparison.OrdinalIgnoreCase) && i + 1 < args.Length)
                {
                    return args[i + 1];
                }
            }
            return args.Length > 0 ? args[0] : null;
        }

        private static bool TryValidateStartUrl(string raw, out string error)
        {
            error = null;
            Uri uri;
            if (string.IsNullOrWhiteSpace(raw) || !Uri.TryCreate(raw, UriKind.Absolute, out uri))
            {
                error = "UNDO requires a local Vite URL. Start the frontend first, then run Start-AceUndoLocal.";
                return false;
            }
            string host = (uri.Host ?? string.Empty).ToLowerInvariant();
            if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
            {
                error = "UNDO accepts only http(s) loopback URLs.";
                return false;
            }
            if (host != "127.0.0.1" && host != "localhost")
            {
                error = "UNDO refuses non-loopback URLs.";
                return false;
            }
            if (!uri.Fragment.Contains("/local-undo"))
            {
                error = "UNDO loads only the local #/local-undo route.";
                return false;
            }
            return true;
        }
    }
}
