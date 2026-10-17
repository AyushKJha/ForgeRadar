package com.forgeradar.mobile;

import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

public final class MainActivity extends ComponentActivity {
    private static final String HOME = "https://forgeradar.onrender.com/";
    private static final String HOST = "forgeradar.onrender.com";
    private WebView webView;
    private LinearLayout errorPanel;
    private ProgressBar loading;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(11, 14, 23));
        getWindow().setNavigationBarColor(Color.rgb(11, 14, 23));
        FrameLayout frame = new FrameLayout(this);
        frame.setBackgroundColor(Color.rgb(11, 14, 23));
        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(11, 14, 23));
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false);
        WebView.setWebContentsDebuggingEnabled(false);
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("https".equals(uri.getScheme()) && HOST.equals(uri.getHost())) return false;
                if ("https".equals(uri.getScheme()) || "mailto".equals(uri.getScheme())) {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                }
                return true;
            }
            @Override public void onPageFinished(WebView view, String url) {
                loading.setVisibility(View.GONE);
                if (errorPanel.getVisibility() != View.VISIBLE) view.setVisibility(View.VISIBLE);
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    view.setVisibility(View.GONE);
                    loading.setVisibility(View.GONE);
                    errorPanel.setVisibility(View.VISIBLE);
                }
            }
        });
        webView.setDownloadListener((url, userAgent, disposition, mimeType, contentLength) -> {
            Uri uri = Uri.parse(url);
            if ("https".equals(uri.getScheme()) && HOST.equals(uri.getHost())) {
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
            }
        });
        frame.addView(webView, new FrameLayout.LayoutParams(-1, -1));
        loading = new ProgressBar(this);
        FrameLayout.LayoutParams progressParams = new FrameLayout.LayoutParams(52, 52, Gravity.CENTER);
        frame.addView(loading, progressParams);
        errorPanel = new LinearLayout(this);
        errorPanel.setOrientation(LinearLayout.VERTICAL);
        errorPanel.setGravity(Gravity.CENTER);
        errorPanel.setPadding(32, 32, 32, 32);
        errorPanel.setBackgroundColor(Color.rgb(11, 14, 23));
        TextView title = new TextView(this);
        title.setText("ForgeRadar is out of reach");
        title.setTextColor(Color.WHITE);
        title.setTextSize(25);
        title.setTypeface(null, Typeface.BOLD);
        title.setGravity(Gravity.CENTER);
        errorPanel.addView(title);
        TextView hint = new TextView(this);
        hint.setText("Check your connection and try again. Projects running on your laptop also need the laptop worker online.");
        hint.setTextColor(Color.rgb(184, 197, 215));
        hint.setTextSize(15);
        hint.setGravity(Gravity.CENTER);
        hint.setPadding(0, 16, 0, 24);
        errorPanel.addView(hint);
        Button retry = new Button(this);
        retry.setText("Try again");
        retry.setOnClickListener(v -> {
            errorPanel.setVisibility(View.GONE);
            loading.setVisibility(View.VISIBLE);
            webView.loadUrl(HOME);
        });
        errorPanel.addView(retry);
        errorPanel.setVisibility(View.GONE);
        frame.addView(errorPanel, new FrameLayout.LayoutParams(-1, -1));
        setContentView(frame);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack();
                else finish();
            }
        });
        if (savedInstanceState == null) webView.loadUrl(HOME);
        else webView.restoreState(savedInstanceState);
    }

    @Override public void onSaveInstanceState(Bundle state) {
        webView.saveState(state);
        super.onSaveInstanceState(state);
    }

    @Override public void onDestroy() {
        if (webView != null) webView.destroy();
        super.onDestroy();
    }
}
