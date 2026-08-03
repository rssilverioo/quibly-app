// tocar — clica e arrasta na janela do Simulador, em coordenadas de tela.
//
// O `click at` do System Events não funciona no Simulador (erro -25204), então
// os eventos são postados direto pelo Quartz. Depende do acesso de
// acessibilidade estar concedido ao app que roda este script — sem ele os
// eventos são silenciosamente descartados, que é o pior modo de falhar; por
// isso o `verificar` checa e diz o que fazer.
//
//   swift scripts/tocar.swift verificar
//   swift scripts/tocar.swift janela   [pedaço do nome]
//   swift scripts/tocar.swift clique     <x> <y>
//   swift scripts/tocar.swift pressionar <x> <y> [ms]
//   swift scripts/tocar.swift arrastar <x1> <y1> <x2> <y2> [ms]
//   swift scripts/tocar.swift frente   [pedaço do nome]
//
// As coordenadas são pontos globais da tela do Mac, origem no canto superior
// esquerdo. Quem converte pixel do aparelho em ponto de tela é o `piloto.mjs`,
// usando o `janela` daqui: sem saber onde a janela está e quanto ela encolheu o
// aparelho, um toque calculado sobre o print cai no lugar errado — e um toque
// no lugar errado navega para outra tela sem avisar, que é o modo de falhar
// mais caro que existe aqui.

import Foundation
import CoreGraphics
import AppKit

func morrer(_ msg: String, _ codigo: Int32 = 1) -> Never {
    FileHandle.standardError.write((msg + "\n").data(using: .utf8)!)
    exit(codigo)
}

/// Sem isto os eventos somem sem erro nenhum.
func exigirAcessibilidade() {
    if !AXIsProcessTrusted() {
        morrer("""
        Sem permissão de acessibilidade — os toques seriam descartados em silêncio.
        Conceda em: System Settings → Privacy & Security → Accessibility,
        habilitando o app que roda este script (Terminal, Maestri, etc).
        """, 3)
    }
}

func mover(_ p: CGPoint) {
    CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, mouseCursorPosition: p, mouseButton: .left)?
        .post(tap: .cghidEventTap)
}

func clicar(_ p: CGPoint) {
    mover(p)
    usleep(40_000)
    CGEvent(mouseEventSource: nil, mouseType: .leftMouseDown, mouseCursorPosition: p, mouseButton: .left)?
        .post(tap: .cghidEventTap)
    usleep(70_000)
    CGEvent(mouseEventSource: nil, mouseType: .leftMouseUp, mouseCursorPosition: p, mouseButton: .left)?
        .post(tap: .cghidEventTap)
}

/// Aperta e segura, sem nenhum evento de arraste no meio.
///
/// Existe porque o `clique` de 70ms não aciona botão dentro de lista rolável: o
/// `UIScrollView` atrasa a entrega do toque (`delaysContentTouches`) para
/// decidir se aquilo vai virar rolagem, e um toque que já acabou antes do prazo
/// não chega ao `Pressable`. Segurar 250ms passa desse prazo. Segurar com
/// `arrastar` não resolve — os eventos de arraste fazem a rolagem tomar o
/// gesto e o botão é cancelado no meio.
func pressionar(_ p: CGPoint, _ ms: Int) {
    mover(p)
    usleep(40_000)
    CGEvent(mouseEventSource: nil, mouseType: .leftMouseDown, mouseCursorPosition: p, mouseButton: .left)?
        .post(tap: .cghidEventTap)
    usleep(UInt32(ms * 1000))
    CGEvent(mouseEventSource: nil, mouseType: .leftMouseUp, mouseCursorPosition: p, mouseButton: .left)?
        .post(tap: .cghidEventTap)
}

/// Arrasta em passos: um salto único vira "flick" e a lista rola demais.
func arrastar(_ de: CGPoint, _ ate: CGPoint, _ duracaoMs: Int) {
    let passos = max(10, duracaoMs / 16)
    mover(de)
    usleep(40_000)
    CGEvent(mouseEventSource: nil, mouseType: .leftMouseDown, mouseCursorPosition: de, mouseButton: .left)?
        .post(tap: .cghidEventTap)
    for i in 1...passos {
        let t = Double(i) / Double(passos)
        let p = CGPoint(x: de.x + (ate.x - de.x) * t, y: de.y + (ate.y - de.y) * t)
        CGEvent(mouseEventSource: nil, mouseType: .leftMouseDragged, mouseCursorPosition: p, mouseButton: .left)?
            .post(tap: .cghidEventTap)
        usleep(UInt32(duracaoMs * 1000 / passos))
    }
    CGEvent(mouseEventSource: nil, mouseType: .leftMouseUp, mouseCursorPosition: ate, mouseButton: .left)?
        .post(tap: .cghidEventTap)
}

/// A janela do Simulador que mostra um aparelho. Bounds já vêm em pontos
/// globais com origem no topo — o mesmo sistema dos eventos do Quartz.
func acharJanela(_ filtro: String?) -> [String: Any]? {
    let lista = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID)
        as? [[String: Any]] ?? []
    let candidatas = lista.filter { j in
        guard (j[kCGWindowOwnerName as String] as? String) == "Simulator" else { return false }
        guard let nome = j[kCGWindowName as String] as? String, !nome.isEmpty else { return false }
        // A janela do aparelho tem altura de tela; painéis auxiliares não.
        guard let b = j[kCGWindowBounds as String] as? [String: Any],
              let h = b["Height"] as? Double, h > 300 else { return false }
        if let f = filtro, !f.isEmpty { return nome.localizedCaseInsensitiveContains(f) }
        return true
    }
    // Nome exato ganha de "contém": com um iPhone 17 e um iPhone 17 Pro Max
    // ligados ao mesmo tempo, procurar por "iPhone 17" achava o Pro Max — e o
    // Pro Max é justamente o que NÃO tem o app instalado.
    if let f = filtro, let exata = candidatas.first(where: { ($0[kCGWindowName as String] as? String) == f }) {
        return exata
    }
    return candidatas.first
}

/// Traz UMA janela para a frente. Ativar o app não basta: com dois aparelhos
/// ligados, as duas janelas se sobrepõem quase pixel a pixel e a de trás recebe
/// o print enquanto a da frente recebe o toque.
func levantar(_ janela: [String: Any]) -> Bool {
    guard let pid = janela[kCGWindowOwnerPID as String] as? pid_t,
          let alvo = janela[kCGWindowName as String] as? String else { return false }
    NSRunningApplication(processIdentifier: pid)?.activate(options: [.activateAllWindows])
    let app = AXUIElementCreateApplication(pid)
    var valor: CFTypeRef?
    guard AXUIElementCopyAttributeValue(app, kAXWindowsAttribute as CFString, &valor) == .success,
          let janelas = valor as? [AXUIElement] else { return false }
    for j in janelas {
        var titulo: CFTypeRef?
        AXUIElementCopyAttributeValue(j, kAXTitleAttribute as CFString, &titulo)
        // O título da acessibilidade traz o runtime junto ("iPhone 17 – iOS
        // 26.5") enquanto o do CGWindow é só o aparelho ("iPhone 17"). Comparar
        // os dois crus nunca casa; e um `hasPrefix` casaria "iPhone 17" com
        // "iPhone 17 Pro Max". Corta-se no travessão e compara-se o aparelho.
        let aparelho = (titulo as? String)?
            .components(separatedBy: "–").first?
            .trimmingCharacters(in: .whitespaces)
        if aparelho == alvo {
            return AXUIElementPerformAction(j, kAXRaiseAction as CFString) == .success
        }
    }
    return false
}

let a = CommandLine.arguments
guard a.count > 1 else { morrer("uso: tocar verificar | janela [nome] | frente [nome] | clique <x> <y> | pressionar <x> <y> [ms] | arrastar <x1> <y1> <x2> <y2> [ms]", 2) }

switch a[1] {
case "verificar":
    exigirAcessibilidade()
    print("acessibilidade concedida")

case "janela":
    guard let j = acharJanela(a.count > 2 ? a[2] : nil),
          let b = j[kCGWindowBounds as String] as? [String: Any] else {
        morrer("""
        Nenhuma janela de aparelho do Simulador está visível\(a.count > 2 ? " com \"\(a[2])\" no nome" : "").
        Abra o Simulador (open -a Simulator) e deixe a janela do aparelho na tela,
        sem minimizar — janela minimizada não aparece na lista e o toque cairia
        no Finder.
        """, 4)
    }
    let nome = (j[kCGWindowName as String] as? String) ?? ""
    let x = b["X"] as? Double ?? 0, y = b["Y"] as? Double ?? 0
    let w = b["Width"] as? Double ?? 0, h = b["Height"] as? Double ?? 0
    let numero = j[kCGWindowNumber as String] as? Int ?? 0
    print("""
    {"nome":"\(nome)","numero":\(numero),"x":\(x),"y":\(y),"largura":\(w),"altura":\(h)}
    """)

case "frente":
    // Um toque só chega no app que está na frente. Sem isto, o primeiro clique
    // de cada série é gasto ativando a janela — e ele acerta um botão.
    guard let j = acharJanela(a.count > 2 ? a[2] : nil) else {
        morrer("Nenhuma janela de aparelho do Simulador visível para trazer à frente.", 4)
    }
    exigirAcessibilidade()
    if !levantar(j) {
        morrer("Achei a janela \"\((j[kCGWindowName as String] as? String) ?? "")\" mas não consegui levantá-la.", 5)
    }
    print("em primeiro plano: \((j[kCGWindowName as String] as? String) ?? "")")

case "clique":
    guard a.count >= 4, let x = Double(a[2]), let y = Double(a[3]) else { morrer("uso: tocar clique <x> <y>", 2) }
    exigirAcessibilidade()
    clicar(CGPoint(x: x, y: y))

case "pressionar":
    guard a.count >= 4, let x = Double(a[2]), let y = Double(a[3]) else { morrer("uso: tocar pressionar <x> <y> [ms]", 2) }
    let ms = a.count > 4 ? Int(a[4]) ?? 250 : 250
    exigirAcessibilidade()
    pressionar(CGPoint(x: x, y: y), ms)

case "arrastar":
    guard a.count >= 6,
          let x1 = Double(a[2]), let y1 = Double(a[3]),
          let x2 = Double(a[4]), let y2 = Double(a[5]) else { morrer("uso: tocar arrastar <x1> <y1> <x2> <y2> [ms]", 2) }
    let ms = a.count > 6 ? Int(a[6]) ?? 300 : 300
    exigirAcessibilidade()
    arrastar(CGPoint(x: x1, y: y1), CGPoint(x: x2, y: y2), ms)

default:
    morrer("comando desconhecido: \(a[1])", 2)
}
