# ==========================================
# ESTÁGIO 1: Build
# ==========================================
FROM node:18-alpine AS builder

WORKDIR /usr/src/app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências
RUN npm install

# Copiar código da aplicação
COPY . .

# ==========================================
# ESTÁGIO 2: Produção com Stunnel
# ==========================================
FROM node:18-alpine

# Instalar OpenSSL e Stunnel
RUN apk add --no-cache openssl stunnel

# Copiar configuração OpenSSL customizada
COPY openssl.cnf /etc/ssl/openssl.cnf
ENV OPENSSL_CONF=/etc/ssl/openssl.cnf

# Criar diretório do stunnel
RUN mkdir -p /etc/stunnel

# Copiar configuração do stunnel
COPY stunnel.conf /etc/stunnel/stunnel.conf

WORKDIR /usr/src/app

# Copiar dependências do estágio anterior
COPY --from=builder /usr/src/app/node_modules ./node_modules

# Copiar código da aplicação
COPY --from=builder /usr/src/app .

# Copiar script de inicialização
COPY start.sh /start.sh
RUN chmod +x /start.sh

# Expor porta da aplicação
EXPOSE 3001

# Usar script de inicialização
CMD ["/start.sh"]