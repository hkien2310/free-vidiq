# 🔥 Find Trend YouTube (100% Local)

Chrome Extension khám phá video viral trên trang chủ YouTube, tính toán tốc độ tăng trưởng **VPH (Views Per Hour)** và **Outlier Multiplier** theo phong cách **vidIQ**, hoạt động **100% Local** (không cần đăng ký tài khoản, không cần API Key, không qua máy chủ trung gian).

---

## ✨ Tính năng chính

1. **Dashboard Modal lớn**:
   - Giao diện Dark Mode lấy cảm hứng từ vidIQ Outlier & Video Filters.
   - Được bảo vệ bằng **Shadow DOM** cô lập tuyệt đối, không gây xung đột CSS với YouTube.
2. **Chỉ số Viral độc quyền**:
   - **⚡ VPH (Views Per Hour)**: Đo tốc độ tăng lượt xem mỗi giờ của từng video.
   - **🔥 Outlier Score (x lần)**: Phát hiện video "đột biến" (tăng trưởng vượt trội so với trung bình).
3. **Bộ lọc Preset thông minh**:
   - **⏱ Recent uploads**: Video mới xuất bản trong tuần.
   - **🚀 Underdogs**: Video lượt xem cao vượt bậc từ các kênh nhỏ / vừa.
   - **👁 Today's top**: Video nhiều view nhất trong 24 giờ qua.
   - **⚡ Trending shorts**: Chỉ lọc video ngắn (Shorts) đang tăng tốc nhanh.
   - **📈 High velocity**: Video có tốc độ VPH bứt phá nhất.
   - **✨ Hidden outliers**: Điểm số đột biến cao nhất.
   - **💎 Evergreens**: Video cũ (đăng > 2 tháng) nhưng vẫn giữ lượng view ổn định.
4. **Bộ lọc tùy chỉnh (Custom Filters)**:
   - Lọc theo khoảng Views (Min - Max).
   - Lọc theo thời gian đăng (Hôm nay, Tuần này, Tháng này, Năm nay).
   - Lọc định dạng (Standard Video hoặc Shorts).
   - Tìm kiếm trực tiếp theo tiêu đề video (Search by title).
5. **Thao tác nhanh**:
   - Nút **⚡ Load more videos**: Tự động gọi phân trang của YouTube Web để nạp thêm video mà không cần cuộn trang.
   - Nút **⬇ Download CSV**: Xuất toàn bộ danh sách video kèm link, chỉ số VPH, Outlier ra file Excel/CSV.

---

## 🚀 Hướng dẫn cài đặt vào Chrome

1. Mở trình duyệt Chrome (hoặc Brave, Cốc Cốc, Edge).
2. Truy cập địa chỉ: `chrome://extensions/`
3. Bật công tắc **Chế độ dành cho nhà phát triển (Developer mode)** ở góc trên bên phải.
4. Bấm nút **Tải tiện ích đã giải nén (Load unpacked)** ở góc trái.
5. Chọn thư mục dự án:
   ```
   /Users/hoangkien/Youtube/extensions/find-trend
   ```
6. Vào trang chủ [YouTube](https://www.youtube.com/) và nhấn `F5` tải lại trang.
7. Bạn sẽ thấy nút **🔥 Find Trend** màu xanh nổi bật ở thanh Header bên phải. Bấm vào để mở bảng điều khiển!
