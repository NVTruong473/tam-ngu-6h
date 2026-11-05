# Tam Ngữ 6H — học Anh–Trung cho iPhone và Android

Tam Ngữ 6H hiện có PWA cài từ Safari/Chrome và nền native Capacitor cho iPhone/Android. Cả hai giữ tiến độ/tra cứu trên chính thiết bị và vẫn mở được khi mất mạng sau lần tải đầu. PWA là bản truy cập nhanh; bản native là lộ trình để có Widget Lock Screen, notification extension và cài đặt tin cậy từ App Store/Google Play.

Xem [lộ trình phát hành native](docs/native-release.md) trước khi ký bản iPhone hoặc Android.

## Trải nghiệm người dùng

- Mặc định có bài mới lúc 06:00, 12:00, 18:00; mỗi iPhone có thể chọn từ 1 đến 24 mốc riêng theo múi giờ của thiết bị.
- Kho bài đệm A2.1 → B1 có sẵn ngoại tuyến. GitHub Actions thử nối tiếp tối đa 3 bài đã kiểm định mỗi ngày; từng ứng viên được kiểm tra và hoàn tác riêng nên Gemini hết quota hay trả bài lỗi cũng không làm hỏng bản đang chạy. Lộ trình tiếp tục B1+ → B2 → B2+ → C1, không phải một “cuốn sách” cố định.
- Nội dung gồm câu ứng dụng, thông điệp và hội thoại ngắn; không quay lại nhóm chào hỏi/số đếm nhập môn.
- Mỗi câu Trung có pinyin, **Đọc gần Việt** và nút phát âm dùng giọng iPhone. “Đọc gần Việt” chỉ là cầu nối, không thay thế nghe giọng Quan thoại chuẩn.
- Tra nhanh Anh/Trung trả nghĩa, sắc thái và hai ví dụ song ngữ. API key Gemini chỉ ở Supabase Edge Function; iPhone chỉ nhận kết quả đã lọc và tự lưu tối đa 30 lần tra gần nhất.
- Trong Cài đặt có **Nhắn cho dev**, mở Google Form phản hồi công khai trong tab mới. Form chỉ hỏi lời nhắn bắt buộc, một lựa chọn quà vui tùy chọn và cách liên hệ tùy chọn; email thông báo phản hồi mới được bật ở Google Forms.

## Điều có thể và không thể làm trên iPhone

Sau khi người dùng cài PWA vào Màn hình chính, mở icon và đồng ý thông báo, Web Push có thể hiện trên Lock Screen kể cả khi app đã đóng. Đây là khả năng chính thức cho Home Screen web app trên iOS/iPadOS 16.4+ và không cần Apple Developer membership. Xem [WebKit: Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).

- Thẻ mới nhất có cùng `tag`, nên thay thẻ cũ thay vì chất thành nhiều thông báo.
- Người dùng có thể vuốt/xóa thẻ hệ thống sau khi đọc; việc xóa một thẻ không tắt ba lịch tiếp theo. Muốn dừng hẳn thì vào app → Cài đặt → Tắt.
- iPhone tự quyết âm thanh, kiểu hiển thị và âm lượng. PWA không thể đặt “âm nhỏ như Notes” cho riêng một thông báo; hãy chỉnh Sounds/âm lượng cảnh báo trong iPhone nếu cần nhẹ hơn.
- PWA **không** thể vẽ lớp giấy trong suốt lên vùng trống Lock Screen, thay hình nền, hay tự có nút `×` nằm trong thẻ hệ thống. Đó là vùng iOS kiểm soát.
- Live Activity/Widget đúng là có giao diện hệ thống riêng, nhưng cần app native ActivityKit/WidgetKit và mô hình phân phối Apple; hơn nữa Live Activity cũng có giới hạn thời gian. Nó không phải phương án miễn phí qua GitHub Pages cho một PWA.

## Vì sao không bê nguyên widget từ các dự án tham khảo

- [a-new-word-every-day](https://github.com/lukefwalton/a-new-word-every-day) có ý tưởng local-first, chọn nội dung theo ngày và ôn lại rất phù hợp: Tam Ngữ giữ tiến độ/cached lookup trên máy và mở rộng nội dung theo lộ trình.
- [Focus-Vocab](https://github.com/VoPhatDat/Focus-Vocab) gợi ý LocalStorage và active recall; chỉ lấy phần lưu cục bộ nhẹ, không mang vào game/rank/tài khoản không cần thiết.
- [widgetkit-daily-language](https://github.com/joshspicer/widgetkit-daily-language) là WidgetKit native; [vocaday_app](https://github.com/hbx921/vocaday_app) là Flutter/mobile store. Chúng hữu ích về UX nhưng không thể thành widget iPhone khi chỉ phát hành qua GitHub Pages.
- [web_vocab_master](https://github.com/HoangCongLap/web_vocab_master) đi theo hướng tài khoản, khóa học và Firebase; hợp với nền tảng nhiều người dùng hơn là món quà local-first này, nên không thêm gánh nặng đăng nhập/thu thập dữ liệu.
- Bài tổng hợp [YBox](https://ybox.vn/ky-nang/toptip-top-5-ung-dung-tao-widget-hien-thi-tu-moi-tieng-anh-moi-ngay-tren-dien-thoai-6976c184f4589005bd8e4d8b) là nguồn cảm hứng về “một nội dung nhìn thấy ngay + ôn lại”, không phải tài liệu kỹ thuật về quyền iOS. Vì vậy bản này chọn **một thẻ Lock Screen tối giản, phần học/tra sâu trong app**, thay vì hứa một widget không thể cài miễn phí.

## Kiến trúc và ranh giới riêng tư

- GitHub Pages: giao diện PWA và kho bài công khai, miễn phí.
- Supabase Edge Function `tam-ngu-api`: giữ VAPID, cron secret và Gemini keys; cung cấp đăng ký Push, gửi Push và `/lookup`. Người dùng không nhập mã hay API key; Gemini key không nằm trong PWA.
- `API_KEYS_FILE=/path/secret.rtfd SUPABASE_PROJECT_REF=... GITHUB_REPOSITORY=NVTruong473/tam-ngu-6h npm run supabase:lookup-secrets` nạp Gemini keys từ RTFD vào Supabase và GitHub Secrets mà không đưa key vào source hoặc log.
- Supabase Cron: gọi bộ điều phối mỗi phút; Edge Function chỉ gửi cho thiết bị có giờ địa phương trùng lịch đã lưu và chống gửi lặp trong cùng phút.
- `tam_ngu_push_subscriptions`: RLS bật; `anon`/`authenticated` không có quyền đọc/ghi, chỉ service role của Edge Function được dùng.

Điểm phải nói thật: GitHub Pages là **website công khai**. Backend chỉ giới hạn lượt tra và xác minh nguồn gọi; nó không biến bundle tĩnh thành app có đăng nhập. Không đặt thông tin riêng tư trong nội dung bài học. Nếu sau này cần kiểm soát truy cập thật sự, cần bổ sung Supabase Auth hoặc lớp phiên đăng nhập.

Gemini free tier cũng không đồng nghĩa “vô hạn tuyệt đối”: quota/mô hình có thể thay đổi. Ứng dụng luôn mang theo kho bài offline đã kiểm định và cache 30 lần tra để không hỏng trải nghiệm khi Gemini hay mạng tạm thời không sẵn sàng.

## Vận hành server an toàn

Các API key không được đưa vào `.env` của PWA hoặc Git. Lệnh dưới đây đọc key từ file cục bộ được chỉ định, đặt chúng thành secret server-side tạm thời qua file quyền `0600`, rồi xóa file tạm:

```bash
API_KEYS_FILE="/Users/vantruong/Documents/api_all" \
SUPABASE_PROJECT_REF="fcsuldrerhbynwotcvyn" \
npm run supabase:lookup-secrets

SUPABASE_PROJECT_REF="fcsuldrerhbynwotcvyn" npm run supabase:deploy
SUPABASE_PROJECT_REF="fcsuldrerhbynwotcvyn" npm run supabase:apply
SUPABASE_PROJECT_REF="fcsuldrerhbynwotcvyn" node scripts/configure-supabase-cron.mjs
SUPABASE_PROJECT_REF="fcsuldrerhbynwotcvyn" npm run supabase:verify
```

`supabase:verify` chỉ in trạng thái đạt/không đạt; nó không in API key hoặc mã mời. Nó dùng một truy vấn Gemini mẫu để kiểm tra luồng tra cứu thật.

Trên GitHub, Secret `GEMINI_API_KEYS` chứa các key phân tách bằng xuống dòng. Workflow thử tạo và phản biện riêng tối đa 3 bài vào 00:23 giờ Việt Nam; chỉ bài đạt mới được nối vào kho. Các Variable công khai `NEXT_PUBLIC_PUSH_API_URL` và `NEXT_PUBLIC_FEEDBACK_FORM_URL` lần lượt chỉ chứa URL Edge Function và URL Form người trả lời, không chứa bí mật. Không đưa link chỉnh sửa Google Form vào repo hoặc bundle.

Workflow giám sát chạy lúc phút 17 mỗi giờ, kiểm tra trang cài PWA, manifest/icon, Service Worker Web Push và trạng thái backend. Nó không gửi nội dung tra cứu hay dữ liệu người dùng; lỗi sẽ hiện thành workflow thất bại trong GitHub Actions.

Mọi thay đổi trong `supabase/functions/tam-ngu-api` được workflow riêng kiểm thử rồi tự triển khai lên đúng project Supabase. GitHub Secret `SUPABASE_ACCESS_TOKEN` là token phạm vi hẹp: chỉ project `caseflow-store`, chỉ quyền đọc/ghi Edge Functions, hết hạn sau 90 ngày; nó không được gửi xuống PWA và không có quyền đọc database, Auth, API keys hoặc Edge Function secrets. Sau deploy, workflow bắt buộc chạy một tra cứu Gemini thật trước khi được coi là thành công.

## Kiểm thử và phát hành

```bash
npm ci
npm run lint
npm test
git push origin main
```

Trên macOS 12, Cloudflare Workers runtime của `vinext dev` không chạy được. Vẫn xem đúng bản tĩnh bằng:

```bash
npm run build:github
npx --yes serve@14 -s dist/client -l 3002
```

GitHub Pages phát hành tại <https://nvtruong473.github.io/tam-ngu-6h/>. Để test thật trên iPhone: mở link này trong Safari → Chia sẻ → **Thêm vào Màn hình chính** → mở icon mới → Bật nhịp → **Hiện bài trên Màn hình khóa** → Allow. Tra nhanh Gemini dùng ngay, không cần nhập mã; khóa API chỉ nằm trong Supabase Edge Function. Thử Push thật cần một iPhone đã subscribe; desktop/static preview chỉ kiểm được giao diện và luồng setup.
