// ocr-tela — lê o texto de um PNG do simulador e imprime uma linha por trecho.
//
// Existe por um motivo só: sem ler a tela, o print-app não tem como saber se o
// deep link realmente navegou. Ele salvava o arquivo com o nome da tela que
// *pediu*, não da que *apareceu* — e um print com nome errado é pior que print
// nenhum, porque parece prova. Isto é o que transforma "pedi a biblioteca" em
// "a biblioteca está mesmo na tela".
//
// Usa o Vision da Apple, que já vem no sistema — sem dependência nova.
//
//   swift scripts/ocr-tela.swift caminho.png
//   swift scripts/ocr-tela.swift caminho.png --caixas
//
// Com `--caixas` cada linha vira `x<TAB>y<TAB>largura<TAB>altura<TAB>texto`, em
// PIXELS da imagem, origem no canto superior esquerdo — o mesmo sistema do
// print do simulador. É o que permite tocar num rótulo: sem coordenada, ler a
// tela só serve para conferir; com ela, serve para navegar.
//
// O Vision devolve caixa normalizada com origem embaixo à esquerda; a conversão
// para o canto de cima acontece aqui, uma vez, para ninguém repetir a inversão
// de Y (e errar o sinal) do lado de fora.

import Foundation
import Vision
import AppKit

guard CommandLine.arguments.count > 1 else {
    FileHandle.standardError.write("uso: ocr-tela <arquivo.png> [--caixas]\n".data(using: .utf8)!)
    exit(2)
}

let caminho = CommandLine.arguments[1]
let comCaixas = CommandLine.arguments.contains("--caixas")

guard let imagem = NSImage(contentsOfFile: caminho),
      let cg = imagem.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    FileHandle.standardError.write("não consegui abrir a imagem: \(caminho)\n".data(using: .utf8)!)
    exit(3)
}

let pedido = VNRecognizeTextRequest()
pedido.recognitionLevel = .accurate
// A UI mistura português e inglês enquanto a tradução não fecha; aceitar os
// dois evita falso negativo na verificação.
pedido.recognitionLanguages = ["pt-BR", "en-US"]
// Correção de idioma "conserta" nomes de produto e rótulos curtos, que é
// justamente o que serve de marcador aqui. Desligada de propósito.
pedido.usesLanguageCorrection = false

do {
    try VNImageRequestHandler(cgImage: cg, options: [:]).perform([pedido])
} catch {
    FileHandle.standardError.write("falha no OCR: \(error)\n".data(using: .utf8)!)
    exit(4)
}

let largura = Double(cg.width)
let altura = Double(cg.height)

for observacao in (pedido.results ?? []) {
    guard let melhor = observacao.topCandidates(1).first else { continue }
    if comCaixas {
        let b = observacao.boundingBox
        let x = b.minX * largura
        // `1 - maxY` porque o Vision conta do rodapé para cima e o print conta
        // do topo para baixo.
        let y = (1 - b.maxY) * altura
        let w = b.width * largura
        let h = b.height * altura
        print(String(format: "%.0f\t%.0f\t%.0f\t%.0f\t%@", x, y, w, h, melhor.string))
    } else {
        print(melhor.string)
    }
}
