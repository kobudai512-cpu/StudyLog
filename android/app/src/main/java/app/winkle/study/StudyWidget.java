package app.winkle.study;
import android.app.*;
import android.appwidget.*;
import android.content.*;
import android.widget.RemoteViews;
import android.view.View;
import java.time.*;
import java.time.temporal.TemporalAdjusters;
import org.json.JSONObject;
public class StudyWidget extends AppWidgetProvider {
 static final String SITE="https://winkle-study.vercel.app";
 static final String REFRESH="app.winkle.study.REFRESH";
 static String week(){return LocalDate.now(ZoneId.of("Asia/Tokyo")).with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).toString();}
 static String duration(int m){return (m/60)+"時間"+(m%60)+"分";}
 @Override public void onUpdate(Context c,AppWidgetManager m,int[] ids){render(c);SyncJob.schedule(c);}
 @Override public void onReceive(Context c,Intent i){super.onReceive(c,i);if(REFRESH.equals(i.getAction())){render(c);SyncJob.schedule(c);}}
 static void render(Context c){
  AppWidgetManager manager=AppWidgetManager.getInstance(c);
  for(int id:manager.getAppWidgetIds(new ComponentName(c,StudyWidget.class))){
   manager.updateAppWidget(id,views(c));
  }
 }
 static RemoteViews views(Context c){
   RemoteViews v=new RemoteViews(c.getPackageName(),R.layout.widget);
   boolean paired=!Storage.token(c).isEmpty();
   String time="—",goal=paired?"データを取得中":"タップして連携",status=Storage.prefs(c).getString("error",""); int progress=0;boolean hasGoal=false;
   try{
    JSONObject data=new JSONObject(Storage.prefs(c).getString("summary","{}"));
    if(week().equals(data.optString("weekStart"))){
     int minutes=data.getInt("minutes");time=duration(minutes);int target=data.optInt("targetMinutes",0);hasGoal=target>0;
     progress=hasGoal?(int)Math.min(100,Math.round(minutes*100.0/target)):0;
     goal=hasGoal?"目標 "+duration(target)+" · "+Math.round(minutes*100.0/target)+"%":"週目標は未設定";
     if(status.isEmpty()){
      ZonedDateTime sync=Instant.parse(data.getString("syncedAt")).atZone(ZoneId.of("Asia/Tokyo"));
      status=(data.optBoolean("stale")?"前回の値 · ":"")+sync.format(java.time.format.DateTimeFormatter.ofPattern("M/d HH:mm"))+" 時点";
     }else status="前回の値 · "+status;
    }else if(paired){goal="今週のデータを更新";if(status.isEmpty())status="更新待ち";}
   }catch(Exception ignored){if(status.isEmpty())status=paired?"更新待ち":"Winkle Study";}
   v.setTextViewText(R.id.time,time);v.setTextViewText(R.id.goal,goal);v.setTextViewText(R.id.status,status);
   v.setViewVisibility(R.id.progress,hasGoal?View.VISIBLE:View.INVISIBLE);v.setProgressBar(R.id.progress,100,progress,false);
   Intent open=paired?new Intent(Intent.ACTION_VIEW,android.net.Uri.parse(SITE)):new Intent(c,MainActivity.class);
   v.setOnClickPendingIntent(R.id.root,PendingIntent.getActivity(c,paired?1:2,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE));
   v.setOnClickPendingIntent(R.id.refresh,PendingIntent.getBroadcast(c,3,new Intent(c,StudyWidget.class).setAction(REFRESH),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE));
   return v;
 }
}
