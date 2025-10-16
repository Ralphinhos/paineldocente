# Estágio de build
FROM node:18-alpine AS builder

# Definir o diretório de trabalho
WORKDIR /usr/src/app

# Copiar os arquivos de manifesto de pacotes
COPY package*.json ./

# Instalar as dependências
RUN npm install

# Copiar o restante dos arquivos da aplicação
COPY . .

# Estágio de produção
FROM node:18-alpine

# Instalar o OpenSSL
RUN apk add --no-cache openssl

# Copiar o arquivo de configuração customizado do OpenSSL
COPY openssl.cnf /etc/ssl/openssl.cnf

# Definir a variável de ambiente para que o sistema use nosso arquivo de configuração
ENV OPENSSL_CONF=/etc/ssl/openssl.cnf

WORKDIR /usr/src/app

# Copiar as dependências instaladas do estágio de build
COPY --from=builder /usr/src/app/node_modules ./node_modules

# Copiar o código da aplicação do estágio de build
COPY --from=builder /usr/src/app .

# Expor a porta que a aplicação vai rodar
EXPOSE 3001

# Comando para iniciar a aplicação
CMD ["node", "server.js"]