import { RecordError } from "./record-input";
export async function requestJson(request: Request) {
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  )
    throw new RecordError("JSON形式で送信してください。", 415);
  if (!request.body) throw new RecordError("入力がありません。");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 8192) {
        await reader.cancel();
        throw new RecordError("入力が大きすぎます。", 413);
      }
      chunks.push(value);
    }
    const all = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      all.set(chunk, offset);
      offset += chunk.length;
    }
    try {
      return JSON.parse(new TextDecoder().decode(all));
    } catch {
      throw new RecordError("入力形式を確認してください。");
    }
  } finally {
    reader.releaseLock();
  }
}
