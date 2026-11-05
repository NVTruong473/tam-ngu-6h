# Tam Ngữ 6H native release

## Mục tiêu phát hành

Tam Ngữ 6H có hai bề mặt cùng dùng một kho bài và Edge Function:

- **PWA** tại GitHub Pages: bản web miễn phí, có thể cài từ Safari/Chrome.
- **Ứng dụng native**: bản phát hành chính cho iPhone và Android. Mã React được
  đóng gói trong Capacitor, nhưng thông báo, biểu tượng, widget và extension là
  thành phần native của mỗi hệ điều hành.

Không dùng `server.url` trong Capacitor. App luôn mang bundle đã kiểm tra trong
gói cài đặt; việc này tránh trở thành một web wrapper tải nội dung tùy ý.

## Thông báo và Màn hình khóa

- Native app đặt trước tối đa 60 bài kế tiếp trên máy. iOS giới hạn 64 local
  notification chờ; 60 chừa chỗ cho hệ thống và hành động trong app.
- Các thẻ là **passive/low importance**: nằm ở Lock Screen và Notification
  Center nhưng không dùng critical/time-sensitive alert hoặc âm báo ép buộc.
- Android dùng `inboxList` và `largeBody`, do đó khi mở rộng sẽ hiện đủ ba dòng
  Anh/Trung/Việt thay vì chỉ một banner cụt.
- Khi người dùng mở app, lịch native được làm mới. Push từ server sẽ là lớp bù
  dài hạn cho trường hợp người dùng không mở app trong nhiều ngày.

Không được hứa “một tờ giấy phủ lên Lock Screen”. iOS luôn sở hữu phần banner
thu gọn. Notification Content Extension chỉ tùy biến được giao diện sau khi
người dùng nhấn giữ/mở rộng. Widget Lock Screen phải do người dùng thêm một
lần trong giao diện Tùy chỉnh Lock Screen của iOS.

## Các bước trước khi ký bản phát hành

1. Cài Xcode đầy đủ và Android Studio/JDK trên máy build; Command Line Tools
   không thể ký hay archive iOS.
2. Đăng ký Apple Developer Program, tạo App ID `com.nvtruong.tamngu6h`, bật
   Push Notifications và App Groups. Không commit certificate, provisioning
   profile, `.p8` APNs key hay `GoogleService-Info.plist` vào Git.
3. Tạo Firebase Android app cùng application ID, tải `google-services.json`
   trực tiếp vào `android/app/` (đã bị bỏ qua khỏi Git), rồi tạo service account
   chỉ trong Supabase secrets để gửi FCM.
4. Tạo iOS WidgetKit target và Notification Content Extension trong Xcode,
   dùng App Group chỉ để chia dữ liệu bài học đã lọc; không chia API key.
5. Phát hành iOS dưới dạng **Unlisted App** để người nhận cài bằng link App
   Store riêng. Android dùng Google Play closed test trước, sau đó unlisted/
   production link. Không gửi APK qua Zalo cho người dùng phổ thông.

## Lệnh phát triển

```bash
npm ci
npm run build:native
npm run native:ios
npm run native:android
```

`build:native` xuất bundle tĩnh rồi đồng bộ vào hai dự án native. Chỉ chạy
`native:ios` trên máy có Xcode đầy đủ và `native:android` trên máy có Android
Studio/JDK.

## Kiểm thử trước phát hành

- Cài fresh trên iPhone thật, Android 13+ và một Android cũ hơn.
- Cho phép/từ chối thông báo, bật/tắt lại, đổi từ 1 lên 24 mốc/ngày, đổi múi
  giờ, mất mạng, khởi động lại máy và mở app sau 3 ngày.
- Xác nhận Tra nhanh vẫn trả dữ liệu khi app native có mạng, còn Gemini key chỉ
  tồn tại trong Supabase secrets.
- Kiểm tra expanded Android notification, iOS long-press extension, widget
  Lock Screen và deep-link về đúng bài.
- Chạy `npm test`, build signed archive và kiểm tra privacy labels trước khi
  gửi App Review/Play review.
