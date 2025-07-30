# Usar uma imagem oficial do Node.js como base
FROM node:20-alpine

# Criar e definir o diretório de trabalho dentro do container
WORKDIR /app

# Copiar os arquivos de manifesto de dependências do diretório 'backend' do host
COPY package.json package-lock.json ./

# Instalar as dependências do projeto
# 'npm ci' é recomendado para ambientes de produção/CI para garantir builds consistentes
RUN npm ci --only=production

# Copiar os arquivos da aplicação do diretório 'backend' do host para o container
COPY . .

# Expor a porta em que o servidor backend está rodando
EXPOSE 3001

# Comando para iniciar o servidor
# Usamos o script 'start' definido no nosso package.json
CMD [ "npm", "start" ]