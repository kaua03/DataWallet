from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Como combinamos, a URL do banco está exposta por enquanto. 
# Depois vamos esconder isso no .env!
URL_DO_BANCO = "postgresql://usuario:senha@localhost:5432/datawallet"

# O "engine" é o motor que mantém a conexão aberta
engine = create_engine(URL_DO_BANCO)

# A "SessionLocal" é a catraca de entrada. Cada vez que um usuário
# acessa o app, abrimos uma sessão para ele fazer consultas.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# A "Base" é o molde que usaremos para criar as nossas tabelas em Python
Base = declarative_base()
