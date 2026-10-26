# Avisos de terceiros

O Pulse FX é distribuído sob a licença MIT. O pacote de release inclui código de
terceiros licenciado sob MIT:

| Componente | Versão | Licença | Uso |
|---|---:|---|---|
| @spresenter/plugin-sdk | 0.5.0 | MIT | SDK oficial, vendorizado em `sdk/spresenter-plugin-sdk.tgz` e embutido no build da UI |
| [React](https://react.dev/) | 18.3.1 | MIT | Runtime da interface, embutido em `dist/ui/` |
| [React DOM](https://react.dev/) | 18.3.1 | MIT | Runtime da interface, embutido em `dist/ui/` |
| [Tailwind CSS](https://tailwindcss.com/) | 4.3.3 | MIT | Utilitários compilados para CSS em `dist/ui/` (o runtime não é distribuído) |

O SDK vendorizado tem SHA-256
`7c0ee0b0c4e5b9fb60834e1da65d782713b0db31419bd788572d3da38c3763de`, registrado
em `sdk/spresenter-plugin-sdk.tgz.sha256` e verificado no CI.

Copyright (c) Spresenter, Meta Platforms, Inc. e colaboradores, e Tailwind Labs,
conforme aplicável.

## Texto da licença MIT

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
