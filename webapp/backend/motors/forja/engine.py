import math
import os
import datetime
from jinja2 import Environment, FileSystemLoader

class ForjaSRank:
    def __init__(self, nome, namespace, id_registro, titulo_cerimonia, subtitulo_cerimonia, view_box=300):
        self.nome = nome
        self.namespace = namespace
        self.id_registro = id_registro
        self.titulo_cerimonia = titulo_cerimonia
        self.subtitulo_cerimonia = subtitulo_cerimonia
        self.view_box = view_box
        self.centro = view_box / 2
        
        self.estilos_css = []
        self.defs_extras = []
        self.camadas_svg = []
        
    def add_estilo(self, css):
        self.estilos_css.append(css)
        
    def add_def(self, def_svg):
        self.defs_extras.append(def_svg)
        
    def add_camada(self, svg):
        self.camadas_svg.append(svg)
        
    def criar_poligono_regular(self, cx, cy, raio, lados, rotacao=0, **kwargs):
        pontos = []
        for i in range(lados):
            ang = math.radians(rotacao + (360 / lados) * i - 90)
            px = cx + raio * math.cos(ang)
            py = cy + raio * math.sin(ang)
            pontos.append(f"{px:.1f},{py:.1f}")
        
        attrs = " ".join([f'{k}="{v}"' for k, v in kwargs.items()])
        return f'<polygon points="{" ".join(pontos)}" {attrs}/>'

    def lapidar_gema(self, cx, cy, raio_externo, raio_interno, lados, cor_base, cor_brilho, cor_sombra, rotacao=0, attrs_grupo=""):
        # Gera o polígono base
        svg = [f'<g {attrs_grupo}>']
        svg.append(self.criar_poligono_regular(cx, cy, raio_externo, lados, rotacao, fill=cor_base))
        
        # Gera as facetas (triângulos que conectam o centro às bordas)
        for i in range(lados):
            ang1 = math.radians(rotacao + (360 / lados) * i - 90)
            ang2 = math.radians(rotacao + (360 / lados) * (i + 1) - 90)
            
            p1_x = cx + raio_externo * math.cos(ang1)
            p1_y = cy + raio_externo * math.sin(ang1)
            p2_x = cx + raio_externo * math.cos(ang2)
            p2_y = cy + raio_externo * math.sin(ang2)
            
            p_int_1_x = cx + raio_interno * math.cos(ang1)
            p_int_1_y = cy + raio_interno * math.sin(ang1)
            p_int_2_x = cx + raio_interno * math.cos(ang2)
            p_int_2_y = cy + raio_interno * math.sin(ang2)

            # Cor varia de acordo com o lado para dar efeito 3D de luz
            cor_ext = cor_brilho if i < lados / 2 else cor_sombra
            cor_int = cor_brilho if i % 2 == 0 else cor_sombra
            
            svg.append(f'  <polygon points="{p_int_1_x:.1f},{p_int_1_y:.1f} {p1_x:.1f},{p1_y:.1f} {p2_x:.1f},{p2_y:.1f} {p_int_2_x:.1f},{p_int_2_y:.1f}" fill="{cor_ext}"/>')
            # Faceta central
            svg.append(f'  <polygon points="{cx:.1f},{cy:.1f} {p_int_1_x:.1f},{p_int_1_y:.1f} {p_int_2_x:.1f},{p_int_2_y:.1f}" fill="{cor_int}"/>')
            
        svg.append('</g>')
        return "\n".join(svg)

    def criar_anel_radial(self, cx, cy, n_elementos, raio_dist, path_elemento, attrs_grupo="", rotacao_offset=0):
        # Clona o path em um círculo radial. O path deve ser desenhado considerando o centro em cx, cy
        # e a Forja cuidará de transladar e rotacionar.
        svg = [f'<g {attrs_grupo}>']
        for i in range(n_elementos):
            ang = rotacao_offset + (360 / n_elementos) * i
            # Rotaciona em torno de (cx, cy)
            svg.append(f'  <g transform="rotate({ang:.1f} {cx} {cy}) translate(0 {-raio_dist})">')
            svg.append(f'    {path_elemento}')
            svg.append(f'  </g>')
        svg.append('</g>')
        return "\n".join(svg)
        
    def desenhar_cunha(self, cx, cy, largura_base, altura, opacidade=1.0, cor="#ffffff"):
        # Uma cunha pontiaguda (usada para estrelas/lâminas)
        p1 = f"{cx - largura_base/2:.1f},{cy}"
        p2 = f"{cx + largura_base/2:.1f},{cy}"
        p3 = f"{cx:.1f},{cy - altura:.1f}"
        return f'<polygon points="{p1} {p2} {p3}" fill="{cor}" opacity="{opacidade}"/>'

    def exportar_js(self, caminho_saida):
        # Resolve o path do template (assumindo que rodamos do root)
        template_dir = os.path.join(os.path.dirname(__file__), 'templates')
        env = Environment(loader=FileSystemLoader(template_dir))
        template = env.get_template('badge_base.js.j2')
        
        context = {
            'nome': self.nome,
            'namespace': self.namespace,
            'id_registro': self.id_registro,
            'titulo_cerimonia': self.titulo_cerimonia,
            'subtitulo_cerimonia': self.subtitulo_cerimonia,
            'data_geracao': datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            'view_box': self.view_box,
            'centro': self.centro,
            'tamanho_cerimonia': 180,
            'estilos_css': "\n".join(self.estilos_css),
            'defs_extras': "\n".join(self.defs_extras),
            'camadas_svg': "\n".join(self.camadas_svg)
        }
        
        js_content = template.render(context)
        with open(caminho_saida, 'w', encoding='utf-8') as f:
            f.write(js_content)
        print(f"[Forja S-Rank] Insígnia '{self.nome}' gerada com sucesso em: {caminho_saida}")
