# Tam Ngữ 6H native release

## Mục tiêu phát hành

Tam Ngữ 6H có hai bề mặt cùng dùng một kho bài và Edge Function:

- **PWA** tại GitHub Pages: bản web miễn phí, có thể cài từ Safari/Chrome.
- **Ứng dụng native**: bản phát hành chính cho iPhone và Android. Mã React được
  đóng gói trong Capacitor, nhưng thông báo, biểu tượng, widget và extension là
  thành phần native của mỗi hệ điều hành.

## Glance Deck — bề mặt học thụ động chính

- WidgetKit extension `TamNguWidgets` đã thay vai trò “thẻ học chính” của thông
  báo. Lock Screen dùng thẻ chữ nhật ngắn; Home Screen và StandBy có đủ ba dòng
  Anh · Trung · Việt. Thông báo chỉ còn là kênh tùy chọn.
- Timeline tự đổi ở 06:00, 12:00 và 18:00 mà không cần mở app. Feed công khai
  `widget-lessons.json` chứa nội dung đã kiểm định, không chứa Gemini key hoặc dữ
  liệu người dùng; widget có ba bài dự phòng khi mất mạng.
- Trên widget Home Screen đủ lớn, nút lật bài chạy bằng App Intent và không mở
  app. Khi điện thoại đang khóa, iOS yêu cầu xác thực trước khi thực hiện nút;
  ứng dụng không được phép vượt qua cơ chế này.
- Widget không phải một web feature: PWA đang cài từ Safari không tự nhận được
  extension. Phải ký và cài bản native, sau đó người dùng thêm widget một lần
  bằng giao diện hệ thống của iOS.

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
4. Kiểm tra WidgetKit target `TamNguWidgets` trên iPhone thật. Chỉ thêm App Group
   nếu cần đồng bộ lịch tùy chỉnh từ app; không chia API key hoặc lịch sử tra cứu.
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

GitHub Actions có build iOS Simulator không ký để bắt lỗi Swift/WidgetKit mà
không lưu certificate. Build xanh không tạo ra IPA có thể cài: tài khoản Apple
miễn phí vẫn hết hạn provisioning sau 7 ngày; phát hành lâu dài cần chương trình
phân phối chính thức của Apple.
