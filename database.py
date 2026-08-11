import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# 1. Abre o arquivo secreto .env e decora as senhas na memória
load_dotenv()

# 2. Pega a Chave Mestra que configuramos lá
URL_DO_BANCO = os.getenv("DATABASE_URL")

# 3. O Motor: Ele quem gerencia a estrada até o Supabase
engine = create_engine(URL_DO_BANCO)

# 4. A Catraca: Toda vez que o celular mandar um dado, 
# abrimos uma "sessão" temporária e depois fechamos, para não travar o banco.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 5. O Molde de Gesso: Usaremos isso no próximo arquivo para 
# esculpir o formato exato das nossas tabelas (Categorias, Contas, etc)
Base = declarative_base()
