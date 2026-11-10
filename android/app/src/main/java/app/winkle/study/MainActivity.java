package app.winkle.study;
import android.app.*;
import android.appwidget.*;
import android.content.*;
import android.os.Bundle;
import android.graphics.Typeface;
import android.widget.*;
import android.view.*;
public class MainActivity extends Activity {
 int dp(int x){return Math.round(x*getResources().getDisplayMetrics().density);}
 TextView text(String s,int size){TextView t=new TextView(this);t.setText(s);t.setTextSize(size);t.setTextColor(getColor(R.color.ink));t.setPadding(0,dp(8),0,dp(8));return t;}
 Button flatButton(){Button button=new Button(this);button.setStateListAnimator(null);return button;}
 void browser(String path){startActivity(new Intent(Intent.ACTION_VIEW,android.net.Uri.parse(StudyWidget.SITE+path)));}
 @Override public void onCreate(Bundle saved){super.onCreate(saved);show();}
 void show(){
  ScrollView scroll=new ScrollView(this);LinearLayout col=new LinearLayout(this);col.setOrientation(LinearLayout.VERTICAL);col.setPadding(dp(24),dp(24),dp(24),dp(24));scroll.addView(col);setContentView(scroll);
  scroll.setOnApplyWindowInsetsListener((v,insets)->{android.graphics.Insets bars=insets.getInsets(WindowInsets.Type.systemBars());v.setPadding(bars.left,bars.top,bars.right,bars.bottom);return insets;});
  TextView title=text("今週を、ホーム画面に。",26);title.setTypeface(null,Typeface.BOLD);col.addView(title);
  col.addView(text("Winkle Study · 学習ウィジェット",14));
  col.addView(text("白黒の表示が端末のライト／ダーク設定に追従します。3×3のままの場合はウィジェットを置き直してください。今週は日本時間の月曜から日曜です。",15));
  Button site=flatButton();site.setText("1. サイトで連携キーを発行");site.setOnClickListener(v->browser("/widget"));col.addView(site);
  EditText input=new EditText(this);input.setHint("2. 連携キーを貼り付け");input.setSingleLine(true);input.setInputType(android.text.InputType.TYPE_CLASS_TEXT|android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD);input.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO);input.setTextColor(getColor(R.color.ink));col.addView(input);
  TextView state=text(Storage.token(this).isEmpty()?"未連携":"連携済み · キーは端末内に暗号化して保存",14);col.addView(state);
  Button save=flatButton();save.setText("連携して更新");save.setOnClickListener(v->{String token=input.getText().toString().trim();if(!token.matches("ws_[A-Za-z0-9_-]{43}")){state.setText("連携キーをそのまま貼り付けてください。");return;}try{Storage.save(this,token);input.setText("");StudyWidget.render(this);SyncJob.schedule(this);state.setText("保存しました。ウィジェットの更新を開始します。");}catch(Exception e){state.setText("保存できませんでした。もう一度お試しください。");}});col.addView(save);
  Button add=flatButton();add.setText("3. ホーム画面にウィジェットを追加");add.setOnClickListener(v->{AppWidgetManager manager=AppWidgetManager.getInstance(this);if(manager.isRequestPinAppWidgetSupported())manager.requestPinAppWidget(new ComponentName(this,StudyWidget.class),null,null);else new AlertDialog.Builder(this).setMessage("ホーム画面の空白を長押し → ウィジェット → Winkle Study を選んでください。").setPositiveButton("OK",null).show();});col.addView(add);
  col.addView(text("通常は約30分ごとに更新します。省電力設定などにより遅れる場合があります。右上の更新アイコンで再取得、本体をタップするとサイトを開きます。",14));
  col.addView(text("アイコンの単色化はホーム画面の「テーマアイコン」を有効にしてください。配色はランチャーの設定に従います。",14));
  Button unlink=flatButton();unlink.setText("この端末の連携を解除");unlink.setOnClickListener(v->new AlertDialog.Builder(this).setMessage("保存したキーと学習時間をこの端末から削除します。キー自体を無効にするにはサイトで連携を解除してください。").setPositiveButton("解除",(d,w)->{Storage.clear(this);getSystemService(android.app.job.JobScheduler.class).cancel(7);StudyWidget.render(this);show();}).setNegativeButton("戻る",null).show());col.addView(unlink);
 }
}
