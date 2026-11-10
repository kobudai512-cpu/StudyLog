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
 static String duration(int m){return m < 60 ? m+"m" : (m/60)+"h"+(m%60 == 0 ? "" : " "+(m%60)+"m");}
 @Override public void onUpdate(Context c,AppWidgetManager m,int[] ids){render(c);SyncJob.schedule(c);}
 @Override public void onReceive(Context c,Intent i){super.onReceive(c,i);if(REFRESH.equals(i.getAction())){render(c);SyncJob.schedule(c);}}
 static void render(Context c){
  AppWidgetManager manager=AppWidgetManager.getInstance(c);
  for(int id:manager.getAppWidgetIds(new ComponentName(c,StudyWidget.class))){
   java.util.Map<android.util.SizeF, RemoteViews> sizes = new java.util.LinkedHashMap<>();
   sizes.put(new android.util.SizeF(96,96),views(c,true));
   sizes.put(new android.util.SizeF(140,140),views(c,false));
   manager.updateAppWidget(id,new RemoteViews(sizes));
  }
 }
 @Override public void onAppWidgetOptionsChanged(Context c,AppWidgetManager manager,int id,android.os.Bundle options){render(c);}
 static RemoteViews views(Context c){return views(c,false);}
 static RemoteViews views(Context c,boolean compact){
   RemoteViews v=new RemoteViews(c.getPackageName(),R.layout.widget);
   if(compact) v.setViewVisibility(R.id.widget_header,View.GONE);
   boolean paired=!Storage.token(c).isEmpty();
   String time="—",goal=paired?"Syncing…":"Tap to connect",status=Storage.prefs(c).getString("error","").isEmpty()?"":"Offline"; int progress=0;boolean hasGoal=false;
   try{
    JSONObject data=new JSONObject(Storage.prefs(c).getString("summary","{}"));
    if(week().equals(data.optString("weekStart"))){
     int minutes=data.getInt("minutes");time=duration(minutes);int target=data.optInt("targetMinutes",0);hasGoal=target>0;
     progress=hasGoal?(int)Math.min(100,Math.round(minutes*100.0/target)):0;
     goal=hasGoal?"/ "+duration(target):"";
     if(status.isEmpty()){
      ZonedDateTime sync=Instant.parse(data.getString("syncedAt")).atZone(ZoneId.of("Asia/Tokyo"));
      status=data.optBoolean("stale") ? "Cached · "+sync.format(java.time.format.DateTimeFormatter.ofPattern("M/d HH:mm")) : "";
      v.setContentDescription(R.id.time, "This week: "+minutes+" minutes. Updated "+sync.toString());
     }else status="Offline · cached";
    }else if(paired){goal="Tap refresh";if(status.isEmpty())status="New week";}
   }catch(Exception ignored){if(status.isEmpty())status=paired?"Sync pending":"";}
   v.setTextViewText(R.id.time,time);v.setTextViewText(R.id.goal,goal);v.setTextViewText(R.id.status,status);
   v.setViewVisibility(R.id.status,status.isEmpty()?View.GONE:View.VISIBLE);
   v.setViewVisibility(R.id.progress,hasGoal?View.VISIBLE:View.INVISIBLE);v.setProgressBar(R.id.progress,100,progress,false);
   Intent open=paired?new Intent(Intent.ACTION_VIEW,android.net.Uri.parse(SITE)):new Intent(c,MainActivity.class);
   v.setOnClickPendingIntent(R.id.root,PendingIntent.getActivity(c,paired?1:2,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE));
   v.setOnClickPendingIntent(R.id.refresh,PendingIntent.getBroadcast(c,3,new Intent(c,StudyWidget.class).setAction(REFRESH),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE));
   return v;
 }
}
