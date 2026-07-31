import sys
import os

# Adiciona o diretório raiz ao path do Python
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from webapp.backend.motors.forja.engine import ForjaSRank

def criar_pena_punidor():
    forja = ForjaSRank(
        nome="Pena do Punidor",
        namespace="PenaPunidorFX",
        id_registro="pena_do_punidor",
        titulo_cerimonia="O PESO DA SENTENÇA",
        subtitulo_cerimonia="O ARQUITETO LEGISLADOR EXIGIU JUSTIÇA",
        view_box=300
    )
    
    # 1. Estilos CSS (Animações Cinéticas)
    forja.add_estilo("""
      .pnp-laminas { transform-origin: 150px 150px; animation: girar-laminas 40s linear infinite; }
      .pnp-laminas-rev { transform-origin: 150px 150px; animation: girar-laminas 25s linear infinite reverse; }
      .pnp-haste { animation: pulsar-haste 3s ease-in-out infinite; }
      .pnp-gema { animation: pulsar-gema 2s ease-in-out infinite; }
      
      @keyframes girar-laminas { 100% { transform: rotate(360deg); } }
      @keyframes pulsar-haste { 0%, 100% { filter: brightness(1); } 50% { filter: brightness(1.3); } }
      @keyframes pulsar-gema { 0%, 100% { fill-opacity: 0.8; } 50% { fill-opacity: 1; } }
    """)
    
    # 2. Definições (Gradientes e Filtros Avançados)
    forja.add_def("""
        <radialGradient id="grad-carmesim" cx="50%" cy="50%">
            <stop offset="0%" stop-color="#ff4444"/>
            <stop offset="60%" stop-color="#8b0000"/>
            <stop offset="100%" stop-color="#2a0000"/>
        </radialGradient>
        <radialGradient id="grad-aco" cx="50%" cy="50%">
            <stop offset="0%" stop-color="#ffffff"/>
            <stop offset="40%" stop-color="#8b9dc3"/>
            <stop offset="100%" stop-color="#2d3d5a"/>
        </radialGradient>
        <radialGradient id="grad-aura" cx="50%" cy="50%">
            <stop offset="0%" stop-color="#ff0000" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
    """)
    
    # Camada de Fundo (Aura/Névoa)
    forja.add_camada('<circle cx="150" cy="150" r="140" fill="url(#grad-aura)"/>')
    
    # 3. Aro Orbital (Traços do Decreto)
    aro_path = '<path d="M 146,15 Q 150,10 154,15" fill="none" stroke="#c0392b" stroke-width="2.5" stroke-linecap="round"/>'
    aro = forja.criar_anel_radial(150, 150, 24, 125, aro_path, 'class="pnp-laminas-rev"')
    forja.add_camada(aro)
    
    # 4. Lâminas Internas (Aço - Sentença)
    lamina_aco = forja.desenhar_cunha(150, 150, 10, 45, cor="url(#grad-aco)")
    anel_aco = forja.criar_anel_radial(150, 150, 12, 65, lamina_aco, 'class="pnp-laminas"', rotacao_offset=15)
    forja.add_camada(anel_aco)
    
    # 5. Lâminas Externas (Carmesim - Punição)
    lamina_carm = forja.desenhar_cunha(150, 150, 12, 65, cor="url(#grad-carmesim)")
    anel_carm = forja.criar_anel_radial(150, 150, 16, 85, lamina_carm, 'class="pnp-laminas-rev"')
    forja.add_camada(anel_carm)
    
    # 6. A Haste da Pena de Tinta
    haste = '''
    <g class="pnp-haste">
        <!-- Corpo da pena -->
        <polygon points="144,250 156,250 165,70 150,20 135,70" fill="#1a1a2e" filter="url(#shadow)"/>
        <!-- Faceta de luz (chanfro metálico) -->
        <polygon points="150,20 165,70 156,250 150,250" fill="#2d1b3d"/>
        <!-- Fenda do bico da pena (nib) -->
        <line x1="150" y1="20" x2="150" y2="60" stroke="#000" stroke-width="2"/>
        <circle cx="150" cy="60" r="3" fill="#000"/>
        
        <!-- Gotas/Veios de sangue escorrendo da pena -->
        <path d="M 150,20 Q 170,10 185,-5 Q 170,-15 150,-25" fill="none" stroke="url(#grad-carmesim)" stroke-width="3" filter="url(#glow)"/>
        <circle cx="185" cy="-5" r="4" fill="#ff4444" filter="url(#glow)"/>
        <circle cx="140" cy="-20" r="3" fill="#ff4444" filter="url(#glow)"/>
        <circle cx="160" cy="0" r="5" fill="#8b0000" filter="url(#glow)"/>
    </g>
    '''
    forja.add_camada(haste)
    
    # 7. Gema Lapidada (Olho de Dragão) cravada no centro
    gema = forja.lapidar_gema(
        cx=150, cy=150, 
        raio_externo=26, raio_interno=12, lados=8, 
        cor_base="#8b0000", cor_brilho="#ff6b6b", cor_sombra="#4a0000", 
        rotacao=22.5, attrs_grupo='class="pnp-gema" filter="url(#shadow)"'
    )
    forja.add_camada(gema)
    # Pupila reptiliana dentro da gema
    forja.add_camada('<ellipse cx="150" cy="150" rx="3" ry="12" fill="#000" transform="rotate(45 150 150)"/>')
    
    # 8. Exportação
    out_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../webapp/frontend/js/badges/pena-do-punidor.js'))
    forja.exportar_js(out_path)

if __name__ == '__main__':
    criar_pena_punidor()
