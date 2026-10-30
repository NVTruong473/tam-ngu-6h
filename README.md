# Tâm Ngữ 6H — PWA cho iPhone

Ứng dụng học Anh–Trung dạng PWA cho iPhone, cài từ Safari lên Màn hình chính, lưu tiến độ trên thiết bị và hoạt động ngoại tuyến sau lần tải đầu.

## Nhịp bài học hằng ngày

- Bài mới được mở theo giờ địa phương lúc 06:00, 12:00 và 18:00.
- 90 bài đầu là bộ đệm ngoại tuyến. Sau đó GitHub Actions nối thêm 3 bài/ngày bằng Gemini, tăng dần từ A2.1 → B1 → B2 → C1 mà không quay vòng về bài đầu.
- Mỗi đợt mới được kiểm tra cấu trúc, số lượt hội thoại và trùng lặp Anh–Trung trước khi nhập kho.
- Mỗi khung giờ có một nhóm lời chúc đa dạng, chọn ổn định theo ngày để không đổi lung tung khi tải lại trang.
- Bài hiện tại và mốc bắt đầu giáo trình được lưu bằng `localStorage`; người mới luôn bắt đầu từ bài 1.
- Khi backend Push được cấu hình, nút **Bật trên Màn hình khóa** đăng ký Web Push. Tệp `.ics` chỉ là phương án dự phòng cho bản chạy không có backend.
- Nội dung thông báo cố ý không tiết lộ bài hay lời chúc để giữ cảm giác tò mò.
- Service worker đã có điểm nhận Web Push. iOS 16.4+ có thể nhận trên Màn hình khóa sau khi PWA được thêm vào Màn hình chính và người dùng cấp quyền; vẫn cần backend lưu subscription và gửi push.
- Khi có bản nội dung hoặc giao diện mới, PWA kiểm tra bản cập nhật khi mở và tự nạp lại app shell mới thay vì giữ bài cũ trong cache.
- Phát âm dùng giọng English/中文 tốt nhất mà iPhone cung cấp, ưu tiên Enhanced/Premium khi đã cài trên máy.

## Kho bài Gemini tự mở rộng

API key chỉ được dùng trong môi trường build và không bao giờ được đóng gói vào trình duyệt. Tạo lại bộ đệm đầu tiên:

```bash
GEMINI_API_KEY="..." npm run generate:curriculum
```

Nối thêm 3 bài vào kho hiện tại:

```bash
API_KEYS_FILE=/đường/dẫn/api_all npm run append:curriculum
```

Trên GitHub, lưu một hoặc nhiều key (ngăn cách bằng xuống dòng) trong Secret `GEMINI_API_KEYS`. Workflow chạy lúc 00:23 giờ Việt Nam, thêm 3 bài rồi phát hành. Nếu Gemini tạm lỗi, bản đang chạy vẫn dùng kho dự phòng và không bị gián đoạn.

## Ranh giới iPhone cần nói thật

- PWA không thể tạo Live Activity. Web Push và lịch iOS vẫn có thể báo khi app đã đóng.
- Live Activity chỉ có trong app native dùng ActivityKit; iOS kết thúc sau tối đa 8 giờ hoạt động và giữ trên Màn hình khóa tối đa thêm 4 giờ.
- Vercel Hobby chỉ chạy cron một lần/ngày và có thể lệch gần một giờ, nên không phù hợp cho ba mốc chính xác. Bản phát hành dùng Supabase Cron + Edge Function, với bảng có tiền tố `tam_ngu_` tách biệt hoàn toàn khỏi dữ liệu nghiệp vụ của Caseflow.

## Backend thông báo đã dùng

- Edge Function: `tam-ngu-api`; chỉ nhận đăng ký qua mã mời, còn tác vụ gửi phải có cron secret.
- Mã ghép đôi được xác thực với backend trước khi lưu cục bộ trên iPhone; mã không nằm trong mã nguồn hay bundle phát hành.
- Lịch Supabase Cron chạy 23:00, 05:00 và 11:00 UTC, tương ứng 06:00, 12:00 và 18:00 tại Việt Nam.
- Subscription được lưu riêng trong `tam_ngu_push_subscriptions`; RLS bật, `anon`/`authenticated` không có quyền đọc ghi.
- Các script cài đặt cục bộ đọc token từ macOS Keychain, không chứa hoặc in API key. Chúng chỉ dành cho máy chủ dự án, không cần chạy trên iPhone.

Điểm cần thẳng thắn: GitHub Pages là website công khai. Mã mời bảo vệ việc **đăng ký nhận Push**, không biến giao diện tĩnh thành ứng dụng có đăng nhập. Chỉ gửi liên kết ghép đôi riêng cho người nhận; nếu cần kiểm soát truy cập tuyệt đối, bước tiếp theo phải là Supabase Auth hoặc một lớp truy cập riêng.

## Chạy thử

```bash
npm ci
npm run dev:static
```

## Đưa lên GitHub Pages

Website hiện được phát hành tự động tại <https://nvtruong473.github.io/tam-ngu-6h/>. Mỗi lần đẩy nhánh `main`, workflow `.github/workflows/deploy-pages.yml` sẽ kiểm tra và cập nhật GitHub Pages.

Trên iPhone: mở liên kết ghép đôi riêng bằng Safari → Chia sẻ → Thêm vào Màn hình chính → bật **Mở dưới dạng ứng dụng** → mở icon vừa tạo → Cài đặt → bật **Thông báo Màn hình khóa**.
