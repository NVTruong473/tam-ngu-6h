# Tâm Ngữ 6H — PWA cho iPhone

Ứng dụng học 36 câu Anh–Trung, cài từ Safari lên Màn hình chính, lưu dữ liệu trên thiết bị và hoạt động ngoại tuyến sau lần tải đầu.

## Nhịp bài học hằng ngày

- Bài mới được mở theo giờ địa phương lúc 06:00, 12:00 và 18:00.
- Mỗi khung giờ có một nhóm lời chúc đa dạng, chọn ổn định theo ngày để không đổi lung tung khi tải lại trang.
- Bài hiện tại, nhịp hằng ngày và danh sách yêu thích được lưu bằng `localStorage`.
- Nút **Thêm lịch nhắc hằng ngày** tạo tệp `.ics` để iOS tự gửi thông báo ngay cả khi PWA đã đóng. Một mốc bất ngờ được giữ kín khỏi phần giới thiệu trong app.
- Nội dung thông báo cố ý không tiết lộ bài hay lời chúc để giữ cảm giác tò mò.
- Service worker đã có sẵn điểm nhận Web Push để nâng cấp sau này khi có máy chủ gửi push.

## Chạy thử

```bash
npm ci
npm run dev:static
```

## Đưa lên GitHub Pages

1. Tạo repository GitHub và đẩy nội dung thư mục này lên nhánh `main`.
2. Vào **Settings → Pages → Source**, chọn **GitHub Actions**.
3. Workflow `.github/workflows/deploy-pages.yml` sẽ build và phát hành tự động.

Trên iPhone: mở link bằng Safari → Chia sẻ → Thêm vào Màn hình chính → bật **Mở dưới dạng ứng dụng**.
