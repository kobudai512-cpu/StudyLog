package app.winkle.study;
import android.app.*;
import android.os.Bundle;
import android.content.*;
import android.widget.*;
import android.view.*;
import org.json.JSONObject;
public class WidgetTests extends Instrumentation {
 void check(boolean condition,String name){if(!condition)throw new AssertionError(name);}
 @Override public void onCreate(Bundle args){super.onCreate(args);start();}
 @Override public void onStart(){
  Bundle result=new Bundle();
  try{
   Context c=getTargetContext();Storage.clear(c);
   check(MainActivity.opensWebsite(new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)),"launcher opens website");
   check(!MainActivity.opensWebsite(new Intent("app.winkle.study.SETUP")),"shortcut opens settings");
   check(!MainActivity.opensWebsite(new Intent(c,MainActivity.class)),"unpaired widget opens settings");
   String token="ws_"+"a".repeat(43);Storage.save(c,token);
   check(Storage.token(c).equals(token),"keystore round trip");
   check(!Storage.prefs(c).getString("key","").contains(token),"encrypted at rest");
   JSONObject fixture=new JSONObject().put("weekStart",StudyWidget.week()).put("minutes",760).put("targetMinutes",900).put("syncedAt",java.time.Instant.now().toString()).put("stale",false);
   Storage.result(c,token,fixture.toString(),"",false);
   Storage.result(c,"ws_wrong",null,"",true);
   check(Storage.token(c).equals(token),"old request cannot revoke replacement");
   Activity activity=startActivitySync(new Intent(c,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
   runOnMainSync(()->{
    View widget=StudyWidget.views(c).apply(activity,new FrameLayout(activity));
    check(((TextView)widget.findViewById(R.id.time)).getText().toString().equals("12h 40m"),"weekly duration");
    check(((TextView)widget.findViewById(R.id.goal)).getText().toString().equals("/ 15h"),"short goal label");
    View compact=StudyWidget.views(c,true).apply(activity,new FrameLayout(activity));
    check(compact.findViewById(R.id.widget_header).getVisibility()==View.GONE,"compact layout removes header");
    check(((TextView)compact.findViewById(R.id.time)).getText().toString().equals("12h 40m"),"compact duration");
    LinearLayout frame=new LinearLayout(activity);frame.setGravity(Gravity.CENTER);frame.setBackgroundColor(0xff888888);
    int size=Math.round(210*c.getResources().getDisplayMetrics().density);frame.addView(widget,new LinearLayout.LayoutParams(size,size));activity.setContentView(frame);
   });
   waitForIdleSync();Thread.sleep(700);
   java.io.File file=new java.io.File(c.getFilesDir(),"widget.png");try(java.io.FileOutputStream out=new java.io.FileOutputStream(file)){getUiAutomation().takeScreenshot().compress(android.graphics.Bitmap.CompressFormat.PNG,100,out);}
   fixture.put("weekStart","2020-01-01");Storage.result(c,token,fixture.toString(),"",false);
   runOnMainSync(()->{View widget=StudyWidget.views(c).apply(activity,new FrameLayout(activity));check(((TextView)widget.findViewById(R.id.time)).getText().toString().equals("—"),"previous week never labelled current");});
   Storage.result(c,token,null,"",true);check(Storage.token(c).isEmpty(),"revoked key removed");check(!Storage.prefs(c).contains("summary"),"revoked cache removed");
   Storage.clear(c);
   IntentFilter filter=new IntentFilter(Intent.ACTION_VIEW);filter.addDataScheme("https");filter.addDataAuthority("winkle-study.vercel.app",null);
   ActivityMonitor browserMonitor=addMonitor(filter,new ActivityResult(Activity.RESULT_OK,null),true);
   runOnMainSync(()->c.startActivity(new Intent(c,MainActivity.class).setAction(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)));
   waitForIdleSync();check(browserMonitor.getHits()==1,"launcher dispatches study URL to browser");removeMonitor(browserMonitor);
   Activity settings=startActivitySync(new Intent(c,MainActivity.class).setAction("app.winkle.study.SETUP").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
   check(!settings.isFinishing(),"settings remain accessible");
   result.putString("stream","PASS: encryption, replacement race, weekly display, goal, week rollover, revocation, screenshot\n");finish(Activity.RESULT_OK,result);
  }catch(Throwable e){result.putString("stream",android.util.Log.getStackTraceString(e));finish(Activity.RESULT_CANCELED,result);}
 }
}
