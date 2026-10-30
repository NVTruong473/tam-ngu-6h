export type Lesson = {
  id: number;
  english: string;
  chinese: string;
  pinyin: string;
  sound: string;
  vietnamese: string;
  category: "Chào hỏi" | "Hằng ngày" | "Đi lại" | "Ăn uống" | "Học tập";
};

export const lessons: Lesson[] = [
  ["Hello", "你好", "nǐ hǎo", "nỉ hảo", "Xin chào", "Chào hỏi"],
  ["Thank you", "谢谢", "xiè xie", "xiê-xiê", "Cảm ơn", "Chào hỏi"],
  ["Good morning", "早上好", "zǎoshang hǎo", "chảo-sang hảo", "Chào buổi sáng", "Chào hỏi"],
  ["Good night", "晚安", "wǎn’ān", "oản-an", "Chúc ngủ ngon", "Chào hỏi"],
  ["Please", "请", "qǐng", "chỉnh", "Xin vui lòng", "Chào hỏi"],
  ["Sorry", "对不起", "duìbuqǐ", "tuây-bu-chỉ", "Xin lỗi", "Chào hỏi"],
  ["It’s okay", "没关系", "méi guānxi", "mấy quan-xi", "Không sao", "Chào hỏi"],
  ["Goodbye", "再见", "zàijiàn", "chai-chiện", "Tạm biệt", "Chào hỏi"],
  ["Yes", "是", "shì", "sư", "Đúng / Phải", "Hằng ngày"],
  ["No", "不是", "bú shì", "bú sư", "Không phải", "Hằng ngày"],
  ["How are you?", "你好吗？", "nǐ hǎo ma?", "nỉ hảo ma?", "Bạn khỏe không?", "Chào hỏi"],
  ["I am fine", "我很好", "wǒ hěn hǎo", "ủa hẩn hảo", "Tôi khỏe", "Chào hỏi"],
  ["What is your name?", "你叫什么名字？", "nǐ jiào shénme míngzi?", "nỉ chiao sấn-mơ mính-chư?", "Bạn tên là gì?", "Chào hỏi"],
  ["My name is…", "我叫……", "wǒ jiào…", "ủa chiao…", "Tôi tên là…", "Chào hỏi"],
  ["Nice to meet you", "很高兴认识你", "hěn gāoxìng rènshi nǐ", "hẩn cao-xing rân-sư nỉ", "Rất vui được gặp bạn", "Chào hỏi"],
  ["Where are you from?", "你从哪里来？", "nǐ cóng nǎlǐ lái?", "nỉ chúng nả-lỉ lái?", "Bạn đến từ đâu?", "Đi lại"],
  ["I am from Vietnam", "我来自越南", "wǒ láizì Yuènán", "ủa lái-chư Uyê-nán", "Tôi đến từ Việt Nam", "Đi lại"],
  ["How much is this?", "这个多少钱？", "zhège duōshao qián?", "chơ-cưa tua-sảo chién?", "Cái này bao nhiêu tiền?", "Đi lại"],
  ["Too expensive", "太贵了", "tài guì le", "thai quy lơ", "Đắt quá", "Đi lại"],
  ["I would like this", "我要这个", "wǒ yào zhège", "ủa yao chơ-cưa", "Tôi muốn cái này", "Đi lại"],
  ["Water", "水", "shuǐ", "suẩy", "Nước", "Ăn uống"],
  ["Food", "食物", "shíwù", "sứ-u", "Thức ăn", "Ăn uống"],
  ["Delicious", "好吃", "hǎochī", "hảo-chư", "Ngon", "Ăn uống"],
  ["Help", "帮助", "bāngzhù", "bang-chu", "Giúp đỡ", "Hằng ngày"],
  ["Where is the restroom?", "洗手间在哪里？", "xǐshǒujiān zài nǎlǐ?", "xỉ-sẩu-chien chai nả-lỉ?", "Nhà vệ sinh ở đâu?", "Đi lại"],
  ["I don’t understand", "我不明白", "wǒ bù míngbai", "ủa bu mính-bai", "Tôi không hiểu", "Học tập"],
  ["Please say it again", "请再说一遍", "qǐng zài shuō yí biàn", "chỉnh chai sua í piện", "Vui lòng nói lại", "Học tập"],
  ["Please speak slowly", "请说慢一点", "qǐng shuō màn yìdiǎn", "chỉnh sua man i-tiển", "Vui lòng nói chậm", "Học tập"],
  ["Today", "今天", "jīntiān", "chin-thien", "Hôm nay", "Hằng ngày"],
  ["Tomorrow", "明天", "míngtiān", "mính-thien", "Ngày mai", "Hằng ngày"],
  ["Yesterday", "昨天", "zuótiān", "chuó-thien", "Hôm qua", "Hằng ngày"],
  ["I love learning", "我喜欢学习", "wǒ xǐhuan xuéxí", "ủa xỉ-hoan xuế-xí", "Tôi thích học tập", "Học tập"],
  ["Keep going", "继续加油", "jìxù jiāyóu", "chi-xuy chia-yấu", "Tiếp tục cố gắng", "Học tập"],
  ["Have a nice day", "祝你今天愉快", "zhù nǐ jīntiān yúkuài", "chu nỉ chin-thien dú-khoai", "Chúc bạn một ngày vui vẻ", "Chào hỏi"],
  ["See you later", "待会儿见", "dāihuìr jiàn", "tai-huây-chr chiện", "Hẹn gặp lại sau", "Chào hỏi"],
  ["Thank you for your help", "谢谢你的帮助", "xièxie nǐ de bāngzhù", "xiê-xiê nỉ tơ bang-chu", "Cảm ơn bạn đã giúp đỡ", "Chào hỏi"],
].map(([english, chinese, pinyin, sound, vietnamese, category], index) => ({
  id: index + 1,
  english,
  chinese,
  pinyin,
  sound,
  vietnamese,
  category,
})) as Lesson[];
