import zipfile, re, os

docx_path = r'c:\Users\ADMIN\Downloads\Báo cáo final (8).docx'
with zipfile.ZipFile(docx_path, 'r') as z:
    rels_xml = z.read('word/_rels/document.xml.rels').decode('utf-8')
    doc_xml = z.read('word/document.xml').decode('utf-8')

rid_to_media = dict(re.findall(r'Id="(rId\d+)"[^>]*Target="media/([^"]+)"', rels_xml))

paras = doc_xml.split('</w:p>')
last_img = None
for p in paras:
    p_text = ''.join(re.findall(r'<w:t[^>]*>([^<]+)</w:t>', p)).strip()
    if 'r:embed' in p:
        m = re.search(r'r:embed="(rId\d+)"', p)
        if m:
            last_img = rid_to_media.get(m.group(1))
    if 'Hình ' in p_text and last_img:
        print(f"{last_img} -> {p_text}")
        last_img = None
