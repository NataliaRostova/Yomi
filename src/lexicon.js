// Original, hand-written starter entries. Extend or replace with your licensed dictionary.
const loanRows = [
  ['パワー','power','力量；功率','既可指人的力量，也可指设备的输出能力。'],
  ['コンピューター','computer','计算机','也常写作「コンピュータ」。'],
  ['コンピュータ','computer','计算机','技术文档中常省略末尾长音。'],
  ['インターネット','internet','互联网','常搭配「インターネットで調べる」。'],
  ['スマートフォン','smartphone','智能手机','口语常缩写为「スマホ」。'],
  ['スマホ','smartphone','智能手机','「スマートフォン」的日语缩略说法。'],
  ['ソフトウェア','software','软件','常用于应用程序和系统软件。'],
  ['ハードウェア','hardware','硬件','指电脑等设备的实体部件。'],
  ['アプリ','application','应用程序','「アプリケーション」的缩略说法。'],
  ['アプリケーション','application','应用程序','也可按语境指应用、运用。'],
  ['ブラウザ','browser','浏览器','也写作「ブラウザー」。'],
  ['ブラウザー','browser','浏览器','用于访问网页的软件。'],
  ['プログラム','program','程序；节目；计划','含义取决于计算机、演出等具体语境。'],
  ['プログラミング','programming','编程','常搭配「プログラミングを学ぶ」。'],
  ['コード','code / cord','代码；编码；电线','计算机语境通常来自 code；电源线语境来自 cord。'],
  ['データ','data','数据；资料','常搭配「データを保存する」。'],
  ['データベース','database','数据库','用于组织和检索数据。'],
  ['ファイル','file','文件；档案夹','既可指电子文件，也可指实体文件夹。'],
  ['フォルダ','folder','文件夹','也写作「フォルダー」。'],
  ['サーバー','server','服务器','也可指饮料供应设备等。'],
  ['ネットワーク','network','网络','可用于计算机网络或人际联系。'],
  ['システム','system','系统；制度','可指技术系统，也可指组织机制。'],
  ['サービス','service','服务；优惠','日语中也常有免费赠送、优惠之意。'],
  ['サポート','support','支持；协助','「サポートする」表示提供支持。'],
  ['ダウンロード','download','下载','可接「する」构成动词。'],
  ['アップロード','upload','上传','可接「する」构成动词。'],
  ['アップデート','update','更新','常用于软件或信息的更新。'],
  ['ログイン','log in','登录','常搭配「ログインする」。'],
  ['ログアウト','log out','退出登录','常搭配「ログアウトする」。'],
  ['パスワード','password','密码','常搭配「パスワードを入力する」。'],
  ['アカウント','account','账号；账户','常用于网络服务账号。'],
  ['クリック','click','点击','常搭配「リンクをクリックする」。'],
  ['リンク','link','链接；关联','「リンクを開く」表示打开链接。'],
  ['ページ','page','页；网页','可用于书籍页码和网页。'],
  ['ウェブ','web','网络；万维网','常用于「ウェブサイト」。'],
  ['サイト','site','网站；场地','网络语境通常指网站。'],
  ['テキスト','text','文本；教材','在学校语境中也可指课本。'],
  ['フォント','font','字体','用于文字的视觉样式。'],
  ['サイズ','size','尺寸；大小','常用于衣物和界面元素。'],
  ['ボタン','botão（葡萄牙语）','按钮；纽扣','指衣物纽扣或界面按钮，原词并非英语。'],
  ['メニュー','menu','菜单；项目列表','用于餐厅，也用于软件界面。'],
  ['エラー','error','错误','常搭配「エラーが発生する」。'],
  ['バグ','bug','程序缺陷','常搭配「バグを修正する」。'],
  ['デザイン','design','设计','可接「する」，表示进行设计。'],
  ['アイデア','idea','想法；点子','也写作「アイディア」。'],
  ['プロジェクト','project','项目','用于工作、研究等计划。'],
  ['チーム','team','团队','常搭配「チームで働く」。'],
  ['ミーティング','meeting','会议','一般用于团队讨论或工作会议。'],
  ['スケジュール','schedule','日程；安排','常搭配「スケジュールを確認する」。'],
  ['ビジネス','business','商务；生意','常用于工作和商业活动。'],
  ['メール','mail','邮件','通常指电子邮件。'],
  ['メッセージ','message','消息；留言','用于聊天、通知等场景。'],
  ['ニュース','news','新闻','日语中没有英语复数词尾变化。'],
  ['メディア','media','媒体；介质','可指传播媒体或存储介质。'],
  ['オンライン','online','在线','如「オンラインで参加する」。'],
  ['オフライン','offline','离线；线下','根据网络或活动语境判断。'],
  ['リモート','remote','远程','常用于「リモートワーク」。'],
  ['リソース','resource','资源','可指计算资源、资料或人力。'],
  ['キャッシュ','cache / cash','缓存；现金','计算机语境是 cache，支付语境是 cash。'],
  ['モデル','model','模型；模特；型号','需要根据上下文选择含义。'],
  ['トークン','token','词元；令牌','语言模型中是文本处理单位，也可指认证令牌。'],
  ['コーヒー','koffie（荷兰语）','咖啡','饮品名，日语借词来自荷兰语。'],
  ['カフェ','café（法语）','咖啡馆','可用于店名或休闲场所。'],
  ['パン','pão（葡萄牙语）','面包','与英语 pan 的意思不同。'],
  ['アルバイト','Arbeit（德语）','兼职；打工','日语中通常指临时或兼职工作。'],
  ['エネルギー','Energie（德语）','能量；精力','用于物理概念，也用于人的精力。'],
  ['テーマ','Thema（德语）','主题；题目','常搭配「テーマを決める」。'],
  ['アンケート','enquête（法语）','问卷；调查','常搭配「アンケートに答える」。'],
  ['レストラン','restaurant','餐厅','一般指提供西餐等的餐馆。'],
  ['ホテル','hotel','酒店','常搭配「ホテルに泊まる」。'],
  ['バス','bus / bath','公交车；浴室','交通语境通常是 bus；住宅设备语境可能是 bath。'],
  ['タクシー','taxi','出租车','常搭配「タクシーに乗る」。'],
  ['ドア','door','门','常搭配「ドアを開ける」。'],
  ['テーブル','table','桌子；表格','根据家具或数据语境判断。'],
  ['ベッド','bed','床','常搭配「ベッドで寝る」。'],
  ['カメラ','camera','相机','也可指手机摄像头。'],
  ['テレビ','television','电视','「テレビジョン」的缩略说法。'],
  ['ラジオ','radio','收音机；广播','常搭配「ラジオを聞く」。'],
  ['ゲーム','game','游戏；比赛','可指电子游戏，也可指体育比赛。'],
  ['スポーツ','sports','体育运动','常搭配「スポーツをする」。'],
  ['サッカー','soccer','足球','指协会足球。'],
  ['テニス','tennis','网球','常搭配「テニスをする」。'],
  ['ピアノ','piano（意大利语）','钢琴','常搭配「ピアノを弾く」。'],
  ['ギター','guitar','吉他','常搭配「ギターを弾く」。'],
  ['クラス','class','班级；类别；类','也可用于编程中的类。'],
  ['テスト','test','测试；考试','常搭配「テストを受ける」。'],
  ['ノート','note','笔记本；笔记','「ノートを取る」表示记笔记。'],
  ['ペン','pen','笔','通常指钢笔、圆珠笔等。'],
  ['プレゼント','present','礼物','「プレゼントする」表示赠送。'],
  ['チャンス','chance','机会','常搭配「チャンスをつかむ」。'],
  ['チャレンジ','challenge','挑战；尝试','常搭配「新しいことにチャレンジする」。'],
  ['スキル','skill','技能','常搭配「スキルを身につける」。'],
  ['レベル','level','水平；等级','常搭配「レベルが高い」。'],
  ['イメージ','image','印象；形象','日语中经常表示脑海中的印象。'],
  ['マンション','mansion（词义已变化）','公寓楼；公寓','日语通常指集合住宅，不等同于英语的豪宅。'],
  ['コンセント','concentric plug（和制缩略）','电源插座','不是英语 consent；英语通常说 outlet / socket。'],
  ['サラリーマン','salary + man（和制英语）','公司职员','英语更常说 office worker。'],
];

const jaRows = [
  ['日本語','日语','「日本語を勉強する」：学习日语。'], ['日本','日本','地名；读音可为「にほん」或「にっぽん」。'],
  ['漢字','汉字','「漢字の読み方」：汉字的读法。'], ['勉強','学习；用功','「〜を勉強する」：学习某个科目。'],
  ['学ぶ','学习；掌握','五段动词；可接「〜を学ぶ」「〜から学ぶ」。'], ['読む','读；阅读','五段动词；「本を読む」：读书。'],
  ['書く','写；书写','五段动词；「文章を書く」：写文章。'], ['聞く','听；询问','「音楽を聞く」听音乐；「先生に聞く」问老师。'],
  ['話す','说；交谈','「日本語を話す」：说日语。'], ['食べる','吃','一段动词；「パンを食べる」：吃面包。'],
  ['飲む','喝；服用','「水を飲む」喝水；「薬を飲む」吃药。'], ['見る','看；观看','一段动词；「映画を見る」：看电影。'],
  ['行く','去','「学校に行く」：去学校。て形是「行って」。'], ['来る','来','不规则动词；「友達が来る」：朋友来。'],
  ['使う','使用','「辞書を使う」：使用词典。'], ['作る','制作；创造','「料理を作る」：做饭。'],
  ['分かる','明白；懂','常用「〜が分かる」表示理解某事。'], ['知る','知道；得知','「知っている」表示已经知道的状态。'],
  ['考える','思考；考虑','一段动词；「方法を考える」：考虑办法。'], ['働く','工作；起作用','「会社で働く」：在公司工作。'],
  ['新しい','新的','い形容词；「新しい言葉」：新词。'], ['楽しい','愉快的；有趣的','い形容词；「勉強が楽しい」：学习很有趣。'],
  ['難しい','困难的','い形容词；「発音が難しい」：发音很难。'], ['小さい','小的','い形容词；「小さい文字」：小字。'],
  ['大きい','大的','い形容词；「大きい声」：大声。'], ['良い','好的','读作「よい」，口语也常用「いい」。'],
  ['今日','今天','一般读作「きょう」；其他读法依语境而定。'], ['明日','明天','常读「あした」，正式场合也可读「あす」。'],
  ['昨日','昨天','日常通常读作「きのう」。'], ['毎日','每天','可直接修饰动作，如「毎日読む」。'],
  ['時間','时间；小时','既可指时间，也可作小时计量。'], ['学生','学生','「大学の学生」：大学的学生。'],
  ['先生','老师；对专业人士的敬称','也用于称呼医生、律师等。'], ['学校','学校','「学校に通う」：上学。'],
  ['大学','大学','「大学で学ぶ」：在大学学习。'], ['友達','朋友','「友達と話す」：和朋友说话。'],
  ['仕事','工作','「仕事をする」：工作。'], ['会社','公司','「会社に勤める」：在公司任职。'],
  ['本','书；本','作为助数词时用于细长物品，读音可能变化。'], ['言葉','语言；词语；话语','「新しい言葉を覚える」：记住新词。'],
  ['文章','文章；语句','「文章を読む」：阅读文章。'], ['意味','意思；意义','「どういう意味ですか」：是什么意思？'],
  ['使い方','使用方法','动词连用形加「方」可表示做某事的方法。'], ['読み方','读法','「この漢字の読み方」：这个汉字的读法。'],
  ['辞書','词典','「辞書で調べる」：查词典。'], ['調べる','调查；查阅','「意味を調べる」：查询意思。'],
  ['便利','方便；便利','な形容词；「便利な機能」：方便的功能。'], ['大切','重要；珍贵','な形容词；「大切にする」：珍惜。'],
  ['簡単','简单','な形容词；「簡単な操作」：简单的操作。'], ['機能','功能','「新しい機能を追加する」：添加新功能。'],
  ['開発','开发','可接「する」，用于软件、产品等开发。'], ['自動','自动','常用「自動で」修饰动作。'],
  ['表示','显示；表示','「読み方を表示する」：显示读法。'], ['設定','设置；设定','「設定を変更する」：更改设置。'],
  ['保存','保存','「データを保存する」：保存数据。'], ['翻訳','翻译','「中国語に翻訳する」：翻译成中文。'],
  ['中国語','汉语；中文','「中国語で説明する」：用中文说明。'], ['英語','英语','「英語を話す」：说英语。'],
  ['説明','说明；解释','「使い方を説明する」：说明用法。'], ['例文','例句','用于展示单词或语法的使用方法。'],
  ['世界','世界','「世界中」表示全世界。'], ['東京','东京','日本地名。'], ['私','我','常读「わたし」，郑重场合可读「わたくし」。'],
];

const enRows = [
  ['power','力量；权力；功率','名词；power to do sth 表示做某事的能力或权力。','Knowledge is power.','知识就是力量。'],
  ['learn','学习；得知','动词；learn to do 学会做；learn from 从……中学习。','We learn something new every day.','我们每天都学到新东西。'],
  ['read','阅读；读懂','动词；过去式和过去分词仍写 read，发音会变化。','I read a book every week.','我每周读一本书。'],
  ['write','写；编写','动词；write about 写有关……的内容；write to 给……写信。'],
  ['language','语言','名词；learn a language 学习一门语言。'], ['word','单词；话语','名词；in other words 换句话说。'],
  ['meaning','含义；意义','名词；the meaning of a word 一个词的意思。'], ['usage','用法；使用情况','名词；强调惯用方式或使用量。'],
  ['example','例子','名词；for example 例如。'], ['context','上下文；背景','名词；in context 结合上下文。'],
  ['understand','理解；明白','动词；过去式和过去分词是 understood。'], ['build','建造；建立','动词；过去式和过去分词是 built。'],
  ['create','创造；创建','动词；create an account 创建账号。'], ['develop','开发；发展','动词；可用于软件开发或能力发展。'],
  ['browser','浏览器','名词；open in a browser 在浏览器中打开。'], ['script','脚本；剧本','名词；技术语境通常指脚本程序。'],
  ['annotation','注释；标注','名词；add annotations 添加标注。'], ['dictionary','词典','名词；look up a word in a dictionary 查词典。'],
  ['translation','翻译；译文','名词；a translation of 原文的翻译。'], ['hover','悬停；盘旋','动词；hover over 将鼠标悬停在……上方。'],
  ['support','支持；支撑','动词或名词；support for 对……的支持。'], ['feature','功能；特征','名词；也可作动词，表示以……为特色。'],
  ['simple','简单的；简朴的','形容词；a simple example 一个简单的例子。'], ['useful','有用的','形容词；be useful for 对……有用。'],
  ['beautiful','美丽的；出色的','形容词；可形容外观或令人欣赏的事物。'], ['different','不同的','形容词；different from 与……不同。'],
  ['important','重要的','形容词；be important to 对……很重要。'], ['new','新的','形容词；be new to 对……不熟悉。'],
  ['every','每一个','限定词；通常接单数可数名词。'], ['day','天；白天','名词；every day 每天。'],
  ['book','书；预订','名词指书，动词可指预订房间或票。'], ['time','时间；次数','名词；on time 准时；in time 及时。'],
  ['work','工作；起作用；作品','动词或名词；work on 从事、处理某项工作。'], ['world','世界','名词；around the world 世界各地。'],
  ['hello','你好','用于问候或引起注意。'], ['welcome','欢迎；受欢迎的','You are welcome 可用于回应感谢。'],
  ['please','请；使满意','礼貌请求中常用 please；也可作动词。'], ['thank','感谢','动词；thank someone for something 因某事感谢某人。'],
  ['computer','计算机','名词；computer science 计算机科学。'], ['software','软件','通常为不可数名词。'],
  ['data','数据；资料','现代用法中可作集合名词；具体单复数依语境。'], ['model','模型；模特；型号','名词或动词，具体意义依领域判断。'],
  ['cache','缓存','计算机名词或动词；clear the cache 清除缓存。'], ['local','本地的；当地的','形容词；local storage 本地存储。'],
  ['privacy','隐私','通常为不可数名词；protect privacy 保护隐私。'], ['setting','设置；环境；背景','软件中 settings 通常指设置项。'],
  ['save','保存；节省；拯救','动词；save changes 保存更改。'], ['open','打开；开放的','可作动词或形容词。'],
  ['close','关闭；近的','动词表示关闭；形容词可表示距离近或关系亲密。'], ['change','改变；变化；零钱','可作动词或名词，需结合语境。'],
  ['use','使用；用途','动词读 /juːz/，名词读 /juːs/。'], ['help','帮助','help someone (to) do 帮助某人做某事。'],
  ['make','制作；使得','make someone do 使某人做某事。'], ['take','拿；带；花费','take time 花时间；take a look 看一看。'],
  ['get','得到；变得','常见多义动词；get started 开始。'], ['look','看；看起来','look at 看；look up 查询。'],
  ['run','跑；运行','技术语境可指运行程序。'], ['set','设置；一组','动词或名词；set up 设置、建立。'],
  ['right','右边；正确的；权利','根据方位、判断或法律语境选择意思。'], ['light','光；轻的；点燃','可作名词、形容词或动词。'],
  ['a','一个；某个','不定冠词，用于辅音音素开头的单数可数名词前。'], ['an','一个；某个','不定冠词，用于元音音素开头的单数可数名词前。'],
  ['the','这个；那个；该','定冠词，通常表示特指或双方已知的事物。'], ['is','是；处于','be 的第三人称单数现在时。'],
  ['are','是；处于','be 的现在时形式，用于 you 及复数主语等。'], ['be','是；存在；成为','系动词或助动词，词形变化较多。'],
  ['and','和；并且','并列连词，连接词、短语或句子。'], ['or','或者；否则','连词，可表示选择或后果。'],
  ['in','在……里；在……期间','介词或副词；in English 用英语。'], ['on','在……上；关于','介词或副词；on Monday 在星期一。'],
  ['of','……的；属于','介词，常表示所属、部分或关联。'], ['to','到；向；用于不定式','介词或不定式标记。'],
  ['for','为了；对于；持续','介词或连词，具体含义取决于搭配。'], ['with','和；带有；用','介词；with a pen 用笔。'],
  ['from','从；来自','介词，表示起点、来源等。'], ['you','你；你们','第二人称代词。'], ['i','我','第一人称单数主格代词，书写时大写。'],
  ['we','我们','第一人称复数主格代词。'], ['it','它；这件事','第三人称代词，也可作形式主语。'],
  ['this','这；这个','指示限定词或代词。'], ['that','那；那个；引导从句','可作指示词或从句连接词。'],
  ['can','能；可以','情态动词后接动词原形。'], ['will','将；愿意','情态动词，也可作名词表示意志。'],
  ['not','不；没有','否定副词；通常与助动词等结合。'], ['by','通过；由；在……旁','介词；by reading 通过阅读。'],
];

export const loans = new Map(loanRows.map(([word, original, meaning, usage]) => [word, { original, meaning, usage, source: '内置常用词库' }]));
export const japanese = new Map(jaRows.map(([word, meaning, usage]) => [word, { meaning, usage, source: '内置常用词库' }]));
export const english = new Map(enRows.map(([word, meaning, usage, example, translation]) => [word, { meaning, usage, example, translation, source: '内置常用词库' }]));
const irregular = { learned:'learn', learnt:'learn', learning:'learn', reading:'read', written:'write', wrote:'write', writing:'write', built:'build', understood:'understand', took:'take', taken:'take', made:'make', ran:'run', running:'run', using:'use', used:'use', was:'be', were:'be', been:'be', being:'be', has:'have', had:'have', does:'do', did:'do', done:'do', went:'go', gone:'go', ate:'eat', eaten:'eat', drank:'drink', drunk:'drink', bought:'buy', brought:'bring', thought:'think', children:'child', better:'good', best:'good', mice:'mouse', studies:'study', studied:'study', studying:'study' };
export const phrases=new Map([
  ['look up',{meaning:'查阅；查询',usage:'look up a word / look a word up：查一个词。宾语是代词时放在中间，如 look it up。也可能表示抬头看，请结合上下文。',example:'She looked it up in a dictionary.',translation:'她在词典里查了这个词。'}],
  ['give up',{meaning:'放弃',usage:'give up doing sth：放弃做某事；give it up：放弃它。',example:'Never give up learning.',translation:'不要放弃学习。'}],
  ['take off',{meaning:'脱下；起飞',usage:'take off a coat / take it off：脱下外套；飞机作主语时通常指起飞。'}],
  ['turn on',{meaning:'打开；接通',usage:'turn on the light / turn it on：打开灯。'}],
  ['turn off',{meaning:'关闭',usage:'turn off the light / turn it off：关灯。'}],
  ['find out',{meaning:'查明；发现',usage:'find out why / find out about：查明原因、了解信息。'}],
  ['set up',{meaning:'建立；设置',usage:'set up a system：建立系统；set it up：设置它。'}],
  ['carry out',{meaning:'执行；开展',usage:'carry out research：开展研究。'}],
  ['look after',{meaning:'照顾；照料',usage:'look after someone：照顾某人。'}],
  ['look forward to',{meaning:'期待',usage:'to 是介词，后接名词或动名词，如 look forward to hearing from you。'}],
  ['in terms of',{meaning:'就……而言',usage:'用于引出评价或讨论的具体方面。'}],
  ['as well as',{meaning:'也；以及',usage:'连接并列内容；主谓一致通常与前面的主语保持一致。'}],
].map(([key,value])=>[key,{...value,pos:'多词表达',source:'内置常用词库'}]));
for(const [key,value] of phrases) english.set(key,value);
for(const [key,meaning,usage] of [
  ['study','学习；研究','study a language 学习语言；过去式 studied。'],['have','有；拥有','也可作完成时助动词，过去式和过去分词为 had。'],['do','做；进行','也可作助动词，过去式 did，过去分词 done。'],
  ['eat','吃','不规则动词，过去式 ate，过去分词 eaten。'],['go','去；进行','不规则动词，过去式 went，过去分词 gone。'],['child','孩子','复数为 children。'],
  ['state-of-the-art','最先进的','通常作定语，如 state-of-the-art technology。'],['well-known','众所周知的；著名的','常用作复合形容词，如 a well-known author。'],
]) english.set(key,{meaning,usage,source:'内置常用词库'});
Object.assign(irregular,{gave:'give',given:'give',giving:'give',found:'find',finding:'find',carried:'carry'});
export function englishForms(raw) {
  const word=raw.normalize('NFKC').replace(/[’‘]/g,"'").toLowerCase();
  return [...new Set([word,irregular[word],word.replace(/'s$/,''),word.replace(/ies$/,'y'),word.replace(/ied$/,'y'),word.replace(/es$/,''),word.replace(/s$/,''),word.replace(/ed$/,''),word.replace(/d$/,''),word.replace(/ing$/,''),word.replace(/ing$/,'e'),word.replace(/([b-df-hj-np-tv-z])\1(?:ed|ing)$/,'$1')].filter(Boolean))];
}
export function localEntry(info) {
  if(info.entry)return info.entry;
  if (info.lang === 'ja') return loans.get(info.word.normalize('NFKC')) || japanese.get(info.base) || japanese.get(info.word);
  const word = info.word.normalize('NFKC').toLowerCase();
  if (english.has(info.base)) return english.get(info.base);
  if (english.has(word)) return english.get(word);
  // Inflection guesses are restricted to words actually present in the starter dictionary.
  const forms = englishForms(word);
  return forms.map(form => english.get(form)).find(Boolean);
}

for(const [word,sourceWord,meaning] of [
  ['データセンター','data center','数据中心'],['クラウドコンピューティング','cloud computing','云计算'],
  ['エージェント','agent','代理人；智能体'],['データベース','database','数据库'],['インフレ','inflation','通货膨胀'],
])loans.set(word,{original:sourceWord,sourceWord,sourceWordConfidence:1,etymologyKind:'borrowed',meaning,usage:'具体含义取决于领域与上下文。',source:'内置常用词库'});
for(const entry of loans.values()) {
  if(!entry.sourceWord && /^[A-Za-z]+(?:[ -][A-Za-z]+){0,2}$/.test(entry.original))Object.assign(entry,{sourceWord:entry.original,sourceWordConfidence:1,etymologyKind:'borrowed'});
}
for(const [word,sourceWord]of [['アルバイト','Arbeit'],['コーヒー','koffie'],['パン','pão']])Object.assign(loans.get(word),{sourceWord,sourceWordConfidence:1,etymologyKind:'borrowed'});
for(const [word,meaning,meaningEn,usage] of [
  ['内閣府','内阁府（日本行政机关）','Cabinet Office','日本政府机关名称。'],
  ['政策','政策','policy','政策を実施する：实施政策。'],['組織','组织；机构','organization','按上下文区分机构与组织结构。'],['制度','制度','system; institution','制度を見直す：重新审视制度。'],
  ['踏まえる','基于；考虑到','consider; take into account','事实或经验 ＋ を踏まえる；不要与字面上踩踏混淆。'],
  ['考慮する','考虑','consider','条件や事情を考慮する。'],['金融政策','货币政策','monetary policy','中央银行通过利率、货币供应等影响经济。'],
  ['個人消費','个人消费','consumer spending','用于经济统计和新闻。'],['市場','市场','market','也可以指交易场所，读音随具体词义变化。'],
  ['株価','股价','stock price','股票的市场价格。'],['利上げ','加息','interest rate hike','提高利率。'],
])japanese.set(word,{meaning,meaningEn,usage,source:'内置常用词库'});

// Curated sense-specific examples. Do not infer associations by splitting synonyms.
english.get('learn').senses=[
  {meaning:'学习；学会',pos:'动词',usage:'learn + 名词；learn to do；learn from + 人或经验。',collocations:'learn a language / learn from mistakes',examples:[{text:'We learn something new every day.',translation:'我们每天都学到新东西。',usage:'learn + 宾语，表示获得知识。'},{text:'She is learning to drive.',translation:'她正在学开车。',usage:'learn to do，学习一项技能。'}]},
  {meaning:'得知；获悉',pos:'动词',usage:'learn that + 从句；learn of/about + 消息或事件。',collocations:'learn of a decision / learn that ...',examples:[{text:'We learned that the meeting had been canceled.',translation:'我们得知会议已被取消。',usage:'that 从句引出得知的内容。'},{text:'I was sorry to learn of his departure.',translation:'得知他离开，我很遗憾。',usage:'learn of，获悉某事。'}]},
];
loans.get('パワー').senses=[
  {meaning:'力量；活力',pos:'名词',usage:'描述人的体力、团队的力量或行动活力。',collocations:'パワーがある / パワーを発揮する',examples:[{text:'若い選手のパワーに圧倒された。',translation:'我被年轻选手的力量震撼了。',usage:'人的力量。'},{text:'チーム全員のパワーを結集する。',translation:'凝聚全队的力量。',usage:'集体的力量。'}]},
  {meaning:'功率；输出能力',pos:'名词',usage:'用于发动机、设备等的输出性能，具体指标取决于领域。',collocations:'エンジンのパワー / パワーを上げる',examples:[{text:'このエンジンは十分なパワーがある。',translation:'这台发动机有足够的动力。',usage:'发动机的输出能力。'},{text:'用途に合わせて機器のパワーを調整する。',translation:'根据用途调整设备的输出。',usage:'设备的输出设置。'}]},
];
