from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker

# ==========================================
# CONEXÃO DIRETA COM O SUPABASE
# Substitua o texto abaixo pela sua URL do Supabase!
# ==========================================
SQLALCHEMY_DATABASE_URL = "https://aoeyeleaxbwvjmzxxdib.supabase.co"

# O motor que conecta o Python ao PostgreSQL do Supabase
engine = create_engine(SQLALCHEMY_DATABASE_URL)

# A fábrica de sessões (como o Python conversa com o banco)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# A classe base para nossos modelos
Base = declarative_base()
