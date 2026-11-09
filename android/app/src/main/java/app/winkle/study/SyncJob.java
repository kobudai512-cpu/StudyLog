package app.winkle.study;
import android.app.job.*;
import android.content.*;
import javax.net.ssl.HttpsURLConnection;
import java.net.URL;
import java.io.*;
import org.json.JSONObject;
public class SyncJob extends JobService {
 private Thread worker;
 static void schedule(Context c){
  if(Storage.token(c).isEmpty()){StudyWidget.render(c);return;}
  JobScheduler jobs=c.getSystemService(JobScheduler.class);
  if(jobs.getPendingJob(7)==null)jobs.schedule(new JobInfo.Builder(7,new ComponentName(c,SyncJob.class)).setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setOverrideDeadline(1000).build());
 }
 @Override public boolean onStartJob(JobParameters params){
  worker=new Thread(()->{
   String token=Storage.token(this);HttpsURLConnection conn=null;
   try{
    if(token.isEmpty())return;
    conn=(HttpsURLConnection)new URL(StudyWidget.SITE+"/api/widget/summary").openConnection();
    conn.setInstanceFollowRedirects(false);conn.setConnectTimeout(15000);conn.setReadTimeout(60000);conn.setRequestProperty("Authorization","Bearer "+token);conn.setRequestProperty("Accept","application/json");
    int code=conn.getResponseCode();
    if(code==401){Storage.result(this,token,null,"",true);return;}
    if(code!=200)throw new IOException();
    StringBuilder body=new StringBuilder();try(Reader r=new InputStreamReader(conn.getInputStream(),java.nio.charset.StandardCharsets.UTF_8)){char[] b=new char[2048];int n;while((n=r.read(b))!=-1){body.append(b,0,n);if(body.length()>16000)throw new IOException();}}
    JSONObject data=new JSONObject(body.toString());
    if(!data.getString("weekStart").matches("[0-9]{4}-[0-9]{2}-[0-9]{2}")||data.getInt("minutes")<0)throw new IOException();
    java.time.Instant.parse(data.getString("syncedAt"));
    if(!Thread.currentThread().isInterrupted())Storage.result(this,token,data.toString(),"",false);
   }catch(Exception e){if(!Thread.currentThread().isInterrupted())Storage.result(this,token,null,"通信できません",false);}
   finally{if(conn!=null)conn.disconnect();StudyWidget.render(this);jobFinished(params,false);}
  },"widget-sync");worker.start();return true;
 }
 @Override public boolean onStopJob(JobParameters params){if(worker!=null)worker.interrupt();return true;}
}
