package com.nhanhvale.write;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.Dialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.util.Base64;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewTreeObserver;
import android.view.Window;
import android.view.WindowManager;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.widget.EditText;
import android.widget.Toast;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

public final class QuickTopicActivity extends Activity {
    static final String QUICK_TOPIC = "com.nhanhvale.write.QUICK_TOPIC";
    private static final String ORIGIN = "https://write.nhanhvale.com/";
    private static final int BASE64_FLAGS = Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING;
    private boolean opening;
    private EditText title;
    private Dialog entryDialog;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        if (QUICK_TOPIC.equals(getIntent().getAction()) && getIntent().getComponent() != null
                && getClass().getName().equals(getIntent().getComponent().getClassName())) {
            showEntry(state);
            return;
        }

        new AlertDialog.Builder(this)
            .setTitle("Write")
            .setMessage("Liên kết một lần bằng Chrome để widget lưu vào dữ liệu Write đang dùng.")
            .setPositiveButton("Liên kết widget", (dialog, which) -> {
                if (openInChrome("write-widget-link=" + getKey())) finish();
                else recreate();
            })
            .setNeutralButton("Mở Write", (dialog, which) -> {
                if (openInChrome("")) finish();
                else recreate();
            })
            .setNegativeButton("Đóng", (dialog, which) -> finish())
            .setOnCancelListener(dialog -> finish())
            .show();
    }

    @SuppressWarnings("deprecation")
    private void showEntry(Bundle state) {
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND);
        getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
        Dialog dialog = new Dialog(this);
        entryDialog = dialog;
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
        View entry = getLayoutInflater().inflate(R.layout.quick_topic_entry, null);
        dialog.setContentView(entry);
        dialog.setOnCancelListener(view -> finish());
        entry.findViewById(R.id.close_topic_entry).setOnClickListener(view -> finish());
        entry.findViewById(R.id.save_topic_entry).setOnClickListener(view -> submit());

        title = entry.findViewById(R.id.topic_entry_title);
        if (state != null) {
            title.setText(state.getString("title", ""));
            title.setSelection(title.length());
        }
        title.setOnEditorActionListener((view, action, event) -> {
            if (event != null && (event.getKeyCode() == KeyEvent.KEYCODE_ENTER
                    || event.getKeyCode() == KeyEvent.KEYCODE_NUMPAD_ENTER)) {
                if (event.getAction() == KeyEvent.ACTION_UP && !event.isCanceled()) submit();
                return true;
            }
            if (action != EditorInfo.IME_ACTION_DONE) return false;
            submit();
            return true;
        });

        Window window = dialog.getWindow();
        window.setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
        window.setGravity(Gravity.BOTTOM);
        window.setDimAmount(0.24f);
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE
            | WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE);
        title.requestFocus();
        title.getViewTreeObserver().addOnWindowFocusChangeListener(new ViewTreeObserver.OnWindowFocusChangeListener() {
            @Override
            public void onWindowFocusChanged(boolean hasFocus) {
                if (!hasFocus) return;
                title.getViewTreeObserver().removeOnWindowFocusChangeListener(this);
                title.post(() -> getSystemService(InputMethodManager.class)
                    .showSoftInput(title, InputMethodManager.SHOW_IMPLICIT));
            }
        });
        dialog.show();
        int maxWidth = Math.round(480 * getResources().getDisplayMetrics().density);
        int screenWidth = getResources().getDisplayMetrics().widthPixels;
        window.setLayout(Math.min(screenWidth, maxWidth), WindowManager.LayoutParams.WRAP_CONTENT);
    }

    @Override
    protected void onSaveInstanceState(Bundle state) {
        super.onSaveInstanceState(state);
        if (title != null) state.putString("title", title.getText().toString());
    }

    @Override
    protected void onDestroy() {
        if (entryDialog != null) entryDialog.dismiss();
        super.onDestroy();
    }

    private void submit() {
        if (opening) return;
        String value = title.getText().toString().trim();
        if (value.isEmpty()) {
            title.setError("Nhập tên chủ đề");
            return;
        }
        try {
            String payload = UUID.randomUUID() + "." + System.currentTimeMillis() + "."
                + encode(value.getBytes(StandardCharsets.UTF_8));
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(Base64.decode(getKey(), BASE64_FLAGS), "HmacSHA256"));
            String signature = encode(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
            opening = openInChrome("write-widget=" + payload + "." + signature);
            if (opening) finish();
        } catch (java.security.GeneralSecurityException error) {
            title.setError("Không gửi được chủ đề. Thử lại.");
        }
    }

    private String getKey() {
        android.content.SharedPreferences prefs = getSharedPreferences("widget", MODE_PRIVATE);
        String key = prefs.getString("key", null);
        if (key == null) {
            byte[] random = new byte[32];
            new SecureRandom().nextBytes(random);
            key = encode(random);
            prefs.edit().putString("key", key).apply();
        }
        return key;
    }

    private static String encode(byte[] bytes) {
        return Base64.encodeToString(bytes, BASE64_FLAGS);
    }

    private boolean openInChrome(String fragment) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(ORIGIN + (fragment.isEmpty() ? "" : "#" + fragment)));
        intent.setPackage("com.android.chrome");
        try {
            startActivity(intent);
            return true;
        } catch (ActivityNotFoundException error) {
            Toast.makeText(this, "Cần cài hoặc bật Google Chrome để dùng widget Write", Toast.LENGTH_LONG).show();
            return false;
        }
    }
}
