package com.forgeradar.mobile;

import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RadialGradient;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.os.Bundle;
import android.animation.ValueAnimator;
import android.graphics.drawable.GradientDrawable;
import android.view.animation.AccelerateDecelerateInterpolator;
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
import android.widget.ImageView;
import android.widget.Space;

import java.util.Random;

public final class MainActivity extends ComponentActivity {
    private static final String HOME = "https://forgeradar.onrender.com/";
    private static final String HOST = "forgeradar.onrender.com";
    private static final int ECLIPSE = Color.rgb(7, 20, 19);
    private static final int SIGNAL_LIME = Color.rgb(196, 237, 114);
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private WebView webView;
    private LinearLayout errorPanel;
    private ProgressBar loading;
    private FrameLayout introOverlay;
    private View introContent;
    private View introOrbit;
    private final Runnable finishIntroRunnable = this::finishIntro;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(ECLIPSE);
        getWindow().setNavigationBarColor(ECLIPSE);
        FrameLayout frame = new FrameLayout(this);
        frame.setBackgroundColor(ECLIPSE);
        webView = new WebView(this);
        webView.setBackgroundColor(ECLIPSE);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(false);
        settings.setTextZoom(100);
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
        errorPanel.setBackgroundColor(ECLIPSE);
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
        if (savedInstanceState == null) frame.addView(createIntroOverlay(), new FrameLayout.LayoutParams(-1, -1));
        setContentView(frame);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack();
                else finish();
            }
        });
        if (savedInstanceState == null) {
            webView.loadUrl(HOME);
            // Keep the intro visible even when Android's system animation scale is disabled.
            // In that case it appears as a clean, static splash and still dismisses on schedule.
            mainHandler.postDelayed(finishIntroRunnable, 2200);
        }
        else webView.restoreState(savedInstanceState);
    }

    private View createIntroOverlay() {
        introOverlay = new FrameLayout(this);
        introOverlay.setBackgroundColor(ECLIPSE);
        introOverlay.addView(new IntroBackdrop(), new FrameLayout.LayoutParams(-1, -1));

        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setGravity(Gravity.CENTER);
        content.setPadding(dp(24), dp(24), dp(24), dp(24));
        FrameLayout.LayoutParams contentParams = new FrameLayout.LayoutParams(-1, -2, Gravity.CENTER);

        FrameLayout emblem = new FrameLayout(this);
        introOrbit = new View(this);
        GradientDrawable orbitShape = new GradientDrawable();
        orbitShape.setShape(GradientDrawable.OVAL);
        orbitShape.setColor(Color.TRANSPARENT);
        orbitShape.setStroke(dp(1), 0x8CC4ED72);
        introOrbit.setBackground(orbitShape);
        FrameLayout.LayoutParams orbitParams = new FrameLayout.LayoutParams(dp(116), dp(82), Gravity.CENTER);
        introOrbit.setRotation(-24f);
        emblem.addView(introOrbit, orbitParams);

        View innerOrbit = new View(this);
        GradientDrawable innerShape = new GradientDrawable();
        innerShape.setShape(GradientDrawable.OVAL);
        innerShape.setColor(0x142C4322);
        innerShape.setStroke(dp(1), 0x36C4ED72);
        innerOrbit.setBackground(innerShape);
        emblem.addView(innerOrbit, new FrameLayout.LayoutParams(dp(92), dp(92), Gravity.CENTER));

        ImageView mark = new ImageView(this);
        mark.setImageResource(R.drawable.ic_launcher_foreground);
        mark.setContentDescription("ForgeRadar FR logo");
        mark.setScaleType(ImageView.ScaleType.FIT_CENTER);
        emblem.addView(mark, new FrameLayout.LayoutParams(dp(88), dp(88), Gravity.CENTER));
        content.addView(emblem, new LinearLayout.LayoutParams(dp(132), dp(132)));
        content.addView(space(18));

        TextView wordmark = introText("ForgeRadar", 27, Color.rgb(241, 248, 235), true);
        content.addView(wordmark);
        content.addView(space(22));

        View divider = new View(this);
        GradientDrawable dividerShape = new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT,
                new int[]{0x00C4ED72, 0xCEC4ED72, 0x00C4ED72});
        divider.setBackground(dividerShape);
        content.addView(divider, new LinearLayout.LayoutParams(dp(170), dp(1)));
        content.addView(space(24));

        TextView kicker = introText("DISCOVER  /  DECIDE  /  BUILD", 10, Color.rgb(175, 196, 164), true);
        kicker.setLetterSpacing(0.18f);
        content.addView(kicker);
        content.addView(space(12));

        TextView headline = introText("From a spark to\nsomething real.", 25, Color.rgb(235, 241, 225), false);
        content.addView(headline);
        content.addView(space(10));

        TextView subline = introText("Your ideas. Your approval. Your next project.", 12, Color.rgb(154, 172, 151), false);
        content.addView(subline);
        introContent = content;
        introContent.setAlpha(0f);
        introContent.setTranslationY(dp(14));
        introContent.setScaleX(0.97f);
        introContent.setScaleY(0.97f);
        if (!ValueAnimator.areAnimatorsEnabled()) {
            introContent.setAlpha(1f);
            introContent.setTranslationY(0f);
            introContent.setScaleX(1f);
            introContent.setScaleY(1f);
        }
        introOverlay.addView(content, contentParams);

        TextView skip = introText("SKIP INTRO   ↗", 10, Color.rgb(202, 217, 191), true);
        skip.setPadding(dp(18), dp(12), dp(18), dp(12));
        GradientDrawable skipShape = new GradientDrawable();
        skipShape.setColor(0x182B3D20);
        skipShape.setCornerRadius(dp(30));
        skipShape.setStroke(dp(1), 0x448FAE69);
        skip.setBackground(skipShape);
        skip.setContentDescription("Skip ForgeRadar introduction");
        skip.setOnClickListener(view -> finishIntro());
        FrameLayout.LayoutParams skipParams = new FrameLayout.LayoutParams(-2, -2, Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL);
        skipParams.bottomMargin = dp(28);
        introOverlay.addView(skip, skipParams);
        introOverlay.setOnClickListener(view -> { });

        if (ValueAnimator.areAnimatorsEnabled()) {
            introContent.animate().alpha(1f).translationY(0).scaleX(1f).scaleY(1f)
                    .setStartDelay(100).setDuration(650).setInterpolator(new AccelerateDecelerateInterpolator()).start();
            introOrbit.animate().rotation(360f).setDuration(3600).setInterpolator(new AccelerateDecelerateInterpolator()).start();
        }
        return introOverlay;
    }

    private TextView introText(String value, float sizeSp, int color, boolean bold) {
        TextView text = new TextView(this);
        text.setText(value);
        text.setTextColor(color);
        text.setTextSize(sizeSp);
        text.setGravity(Gravity.CENTER);
        if (bold) text.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        return text;
    }

    private Space space(int heightDp) {
        Space space = new Space(this);
        space.setLayoutParams(new LinearLayout.LayoutParams(1, dp(heightDp)));
        return space;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void finishIntro() {
        mainHandler.removeCallbacks(finishIntroRunnable);
        if (introOverlay == null || introOverlay.getVisibility() != View.VISIBLE) return;
        if (!ValueAnimator.areAnimatorsEnabled()) {
            introOverlay.setVisibility(View.GONE);
            return;
        }
        introOverlay.animate().alpha(0f).setDuration(420).setInterpolator(new AccelerateDecelerateInterpolator())
                .withEndAction(() -> introOverlay.setVisibility(View.GONE)).start();
    }

    private final class IntroBackdrop extends View {
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Random stars = new Random(42);

        IntroBackdrop() { super(MainActivity.this); }

        @Override protected void onDraw(Canvas canvas) {
            super.onDraw(canvas);
            float cx = getWidth() * 0.5f;
            float cy = getHeight() * 0.42f;
            float radius = Math.max(getWidth(), getHeight()) * 0.72f;
            paint.setShader(new RadialGradient(cx, cy, radius,
                    new int[]{0x202E4B1E, ECLIPSE, ECLIPSE}, new float[]{0f, 0.52f, 1f}, Shader.TileMode.CLAMP));
            canvas.drawRect(0, 0, getWidth(), getHeight(), paint);
            paint.setShader(null);
            paint.setColor(0x667C985E);
            for (int i = 0; i < 44; i++) {
                float x = stars.nextFloat() * getWidth();
                float y = stars.nextFloat() * getHeight();
                float point = i % 7 == 0 ? dp(1.5f) : dp(0.8f);
                canvas.drawCircle(x, y, point, paint);
            }
        }

        private int dp(float value) {
            return Math.round(value * getResources().getDisplayMetrics().density);
        }
    }

    @Override public void onSaveInstanceState(Bundle state) {
        webView.saveState(state);
        super.onSaveInstanceState(state);
    }

    @Override public void onDestroy() {
        mainHandler.removeCallbacks(finishIntroRunnable);
        if (webView != null) webView.destroy();
        super.onDestroy();
    }
}
