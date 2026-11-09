package app.winkle.study;
import android.content.*;
import android.security.keystore.*;
import android.util.Base64;
import java.security.KeyStore;
import javax.crypto.*;
import javax.crypto.spec.GCMParameterSpec;
final class Storage {
 static final String ALIAS="winkle-widget";
 static android.content.SharedPreferences prefs(Context c){return c.getSharedPreferences("widget",Context.MODE_PRIVATE);}
 static javax.crypto.SecretKey key() throws Exception {
  KeyStore ks=KeyStore.getInstance("AndroidKeyStore");ks.load(null);
  if(!ks.containsAlias(ALIAS)){KeyGenerator gen=KeyGenerator.getInstance("AES","AndroidKeyStore");gen.init(new KeyGenParameterSpec.Builder(ALIAS,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());gen.generateKey();}
  return (javax.crypto.SecretKey)ks.getKey(ALIAS,null);
 }
 static synchronized void save(Context c,String token) throws Exception {
  Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key());
  String value=Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP)+":"+Base64.encodeToString(cipher.doFinal(token.getBytes(java.nio.charset.StandardCharsets.UTF_8)),Base64.NO_WRAP);
  if(!prefs(c).edit().clear().putString("key",value).commit())throw new Exception("保存失敗");
 }
 static synchronized String token(Context c) {
  try{String v=prefs(c).getString("key","");if(v.isEmpty())return "";String[] parts=v.split(":");Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(parts[0],Base64.NO_WRAP)));return new String(cipher.doFinal(Base64.decode(parts[1],Base64.NO_WRAP)),java.nio.charset.StandardCharsets.UTF_8);}catch(Exception e){return "";}
 }
 static synchronized void clear(Context c){prefs(c).edit().clear().commit();}
 static synchronized void result(Context c,String expected,String json,String error,boolean revoked){
  if(!token(c).equals(expected))return;
  if(revoked){prefs(c).edit().clear().putString("error","連携キーを再設定").commit();return;}
  android.content.SharedPreferences.Editor edit=prefs(c).edit().putString("error",error);
  if(json!=null)edit.putString("summary",json);edit.commit();
 }
}
