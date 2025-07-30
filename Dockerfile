# Stage 1: Build a aplicação frontend
FROM node:20-alpine AS build

# Define o diretório de trabalho dentro do container
WORKDIR /app

# Copia os arquivos de manifesto de dependências
COPY package.json package-lock.json ./

# Instala as dependências do projeto
# Usamos 'npm ci' para uma instalação limpa e previsível baseada no lockfile
RUN npm ci

# Copia o restante dos arquivos da aplicação
COPY . .

# Executa o build da aplicação Vite
RUN npm run build

# Stage 2: Serve a aplicação com Nginx
FROM nginx:1.27-alpine

# Define o diretório de trabalho para a configuração do Nginx
WORKDIR /etc/nginx

# Remove a configuração padrão do Nginx
RUN rm -rf ./conf.d/*

# Copia a nossa configuração personalizada do Nginx (que criaremos a seguir)
COPY nginx.conf ./conf.d/default.conf

# Define o diretório de trabalho para os arquivos estáticos
WORKDIR /usr/share/nginx/html

# Remove os arquivos padrão do Nginx
RUN rm -rf ./*

# Copia os arquivos estáticos gerados no 'build stage'
COPY --from=build /app/dist .

# Expõe a porta 80 (padrão do Nginx)
EXPOSE 80

# Comando para iniciar o Nginx em primeiro plano
CMD ["nginx", "-g", "daemon off;"]
