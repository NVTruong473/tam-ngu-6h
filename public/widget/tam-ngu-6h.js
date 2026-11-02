// Tam Ngữ 6H · Bộ nạp widget cho Scriptable (iOS 16+)
// Không chứa API key hoặc dữ liệu riêng tư. Phần hiển thị tự cập nhật và có bản lưu ngoại tuyến.

const TAM_NGU_CONFIG = {"schedule":["06:00","12:00","18:00"],"routineStartSequence":null};
const TAM_NGU_RUNTIME_URL = "https://nvtruong473.github.io/tam-ngu-6h/widget/runtime-v1.js";
const TAM_NGU_RUNTIME_CACHE = "tam-ngu-6h-runtime-v1.js";

const tamNguFiles = FileManager.local();
const tamNguRuntimePath = tamNguFiles.joinPath(tamNguFiles.libraryDirectory(), TAM_NGU_RUNTIME_CACHE);
let tamNguRuntime;

try {
  const request = new Request(TAM_NGU_RUNTIME_URL);
  request.timeoutInterval = 10;
  tamNguRuntime = await request.loadString();
  if (!tamNguRuntime.includes("TAM_NGU_RUNTIME_V1")) throw new Error("Invalid Tam Ngữ runtime");
  tamNguFiles.writeString(tamNguRuntimePath, tamNguRuntime);
} catch (error) {
  if (!tamNguFiles.fileExists(tamNguRuntimePath)) throw error;
  tamNguRuntime = tamNguFiles.readString(tamNguRuntimePath);
}

const runTamNguWidget = importModule(tamNguRuntimePath);
await runTamNguWidget(TAM_NGU_CONFIG);
