# Tâm Ngữ 6H — PWA cho iPhone

Ứng dụng học Anh–Trung dạng PWA cho iPhone, cài từ Safari lên Màn hình chính, lưu tiến độ trên thiết bị và hoạt động ngoại tuyến sau lần tải đầu.

## Nhịp bài học hằng ngày

- Bài mới được mở theo giờ địa phương lúc 06:00, 12:00 và 18:00.
- 90 bài trong 30 ngày, mở dần từ A2.1 đến B1: 30 câu ứng dụng, 30 thông điệp và 30 hội thoại ngắn.
- Mỗi khung giờ có một nhóm lời chúc đa dạng, chọn ổn định theo ngày để không đổi lung tung khi tải lại trang.
- Bài hiện tại và mốc bắt đầu giáo trình được lưu bằng `localStorage`; người mới luôn bắt đầu từ bài 1.
- Nút **Thêm lịch nhắc hằng ngày** tạo tệp `.ics` để iOS tự gửi thông báo ngay cả khi PWA đã đóng. Một mốc bất ngờ được giữ kín khỏi phần giới thiệu trong app.
- Nội dung thông báo cố ý không tiết lộ bài hay lời chúc để giữ cảm giác tò mò.
- Service worker đã có sẵn điểm nhận Web Push để nâng cấp sau này khi có máy chủ gửi push.
- Phát âm dùng giọng English/中文 tốt nhất mà iPhone cung cấp, ưu tiên Enhanced/Premium khi đã cài trên máy.

## Tạo lại giáo trình bằng Gemini

API key chỉ được dùng ở bước build và không bao giờ được đóng gói vào trình duyệt:

```bash
GEMINI_API_KEY="..." npm run generate:curriculum
```

Trên GitHub, lưu key dưới tên Secret `GEMINI_API_KEY`. Nếu không có Secret, workflow dùng nguyên 90 bài đã kiểm tra trong repository.

## Chạy thử

```bash
npm ci
npm run dev:static
```

## Đưa lên GitHub Pages

Website hiện được phát hành tự động tại <https://nvtruong473.github.io/tam-ngu-6h/>. Mỗi lần đẩy nhánh `main`, workflow `.github/workflows/deploy-pages.yml` sẽ kiểm tra và cập nhật GitHub Pages.

Trên iPhone: mở link bằng Safari → Chia sẻ → Thêm vào Màn hình chính → bật **Mở dưới dạng ứng dụng**.
