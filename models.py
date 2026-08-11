from sqlalchemy import Column, Integer, String, Float, ForeignKey, Date
from sqlalchemy.orm import relationship
from database import Base

class Usuario(Base):
    __tablename__ = "usuarios" # O nome exato da tabela lá no Supabase

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, nullable=False) # nullable=False é o nosso antigo NOT NULL
    email = Column(String, unique=True, nullable=False)
    senha_hash = Column(String, nullable=False)

    # O relationship é a mágica do Python. 
    # Ele permite que você digite usuario.contas e receba a lista de transações automaticamente, sem fazer SQL.
    categorias = relationship("Categoria", back_populates="dono")
    transacoes = relationship("Transacao", back_populates="dono")

class Categoria(Base):
    __tablename__ = "categorias"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, nullable=False)
    tipo = Column(String, nullable=False) # Receita ou Despesa
    cor = Column(String)
    
    # A Chave Estrangeira! Aponta para o ID da tabela 'usuarios'
    usuario_id = Column(Integer, ForeignKey("usuarios.id")) 
    
    # A contraparte do relationship lá de cima
    dono = relationship("Usuario", back_populates="categorias")
    transacoes = relationship("Transacao", back_populates="categoria")

class Transacao(Base):
    __tablename__ = "transacoes"

    id = Column(Integer, primary_key=True, index=True)
    valor = Column(Float, nullable=False) # Usando Float para simplificar no SQLite/Postgres básico do ORM
    tipo = Column(String, nullable=False) # Receita ou Despesa
    descricao = Column(String)
    data_vencimento = Column(Date, nullable=False)
    data_pagamento = Column(Date)
    status = Column(String, default="Pendente")

    usuario_id = Column(Integer, ForeignKey("usuarios.id"))
    categoria_id = Column(Integer, ForeignKey("categorias.id"))

    dono = relationship("Usuario", back_populates="transacoes")
    categoria = relationship("Categoria", back_populates="transacoes")
