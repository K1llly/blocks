import json
import time
import os

class K1lllyFlowEngine:
    def __init__(self, flow_file_path):
        self.flow_file_path = flow_file_path
        self.flow_data = self.load_flow()
        # Veri güvenliği için get metoduyla varsayılan boş liste ataması
        self.blocks = {b['id']: b for b in self.flow_data.get('blocks', [])}
        self.connections = self.flow_data.get('connections', [])

    def load_flow(self):
        """JSON dosyasını diskten okur."""
        try:
            with open(self.flow_file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                meta = data.get('meta', {})
                print(f"\n✅ Proje Yüklendi: {meta.get('projectName', 'İsimsiz')} (v{meta.get('version', '?.?')})")
                print("-" * 50)
                return data
        except Exception as e:
            print(f"❌ HATA: JSON okunamadı. {str(e)}")
            exit()

    def find_start_block(self):
        """GİRİŞ tipindeki bloğu bulur."""
        for block in self.blocks.values():
            if block['type'] == 'giris':
                return block
        return None

    def get_next_block_id(self, current_block_id):
        """Mevcut bloktan çıkan bağlantıyı bulur."""
        for conn in self.connections:
            if conn['from'] == current_block_id:
                return conn['to']
        return None

    def execute_block(self, block):
        """Bloğu çalıştırır."""
        b_type = block['type'].upper()
        # Data alanı yoksa hata vermemesi için güvenli erişim
        data = block.get('data', {})
        title = data.get('title', 'Başlıksız')
        content = data.get('body', 'İçerik yok')
        
        print(f"[{b_type}] -> {title}")
        print(f"   └── 📝 {content}")
        
        time.sleep(0.8) # Okuma kolaylığı için bekleme
        
        if block['type'] == 'gelisme':
            print("   ⚙️  AI Motoru Devrede... (İşleniyor)")
            time.sleep(1)

    def run(self):
        """Motoru başlatır."""
        current_block = self.find_start_block()
        
        if not current_block:
            print("❌ HATA: Akışta 'GİRİŞ' bloğu bulunamadı!")
            return

        print("🚀 K1LLLY Akış Motoru Başlatılıyor...\n")

        while current_block:
            self.execute_block(current_block)
            next_id = self.get_next_block_id(current_block['id'])
            
            if next_id:
                print("      ⬇️")
                current_block = self.blocks.get(next_id)
            else:
                print("      🛑")
                print("\n🏁 Akış Başarıyla Tamamlandı.")
                current_block = None

# --- YENİ EKLENEN KISIM: DOSYA SEÇTİRME ---
def list_and_select_file():
    # Script'in çalıştığı klasörü bul
    base_dir = os.path.dirname(os.path.abspath(__file__))
    # json-files klasörünün tam yolunu oluştur
    target_dir = os.path.join(base_dir, "json-files")

    # Klasör var mı kontrol et
    if not os.path.exists(target_dir):
        print(f"❌ HATA: '{target_dir}' klasörü bulunamadı!")
        print("Lütfen 'runner.py' dosyasının yanına 'json-files' klasörü oluşturun.")
        return None

    # Sadece .json ile biten dosyaları listele
    files = [f for f in os.listdir(target_dir) if f.endswith('.json')]
    
    if not files:
        print(f"⚠️  UYARI: '{target_dir}' klasöründe hiç JSON dosyası yok.")
        return None

    # Dosyaları tarihe göre sırala (En yeni en üstte) - Opsiyonel ama kullanışlı
    files.sort(key=lambda x: os.path.getmtime(os.path.join(target_dir, x)), reverse=True)

    print("\n📂 MÜSAİT AKIŞ DOSYALARI:")
    print("=" * 30)
    for i, file_name in enumerate(files, 1):
        print(f"[{i}] {file_name}")
    print("=" * 30)

    while True:
        try:
            selection = input(f"👉 Çalıştırmak istediğin dosya numarası (1-{len(files)}): ")
            idx = int(selection) - 1
            if 0 <= idx < len(files):
                selected_file = files[idx]
                return os.path.join(target_dir, selected_file)
            else:
                print("❌ Geçersiz numara, tekrar dene.")
        except ValueError:
            print("❌ Lütfen sadece sayı girin.")

if __name__ == "__main__":
    # Dosya seçme fonksiyonunu çağır
    selected_path = list_and_select_file()
    
    # Eğer geçerli bir dosya seçildiyse motoru başlat
    if selected_path:
        engine = K1lllyFlowEngine(selected_path)
        engine.run()