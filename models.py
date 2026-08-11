from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

# 1. A Planta da Tabela de Usuários
class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    senha_hash = Column(String, nullable=False)

    # A mágica do Python: Ele entende que o usuário é "dono" de categorias e contas
    categorias = relationship("Categoria", back_populates="dono")
    transacoes = relationship("Transacao", back_populates="dono")

# 2. A Planta da Tabela de Categorias (Para organizar as despesas)
class Categoria(Base):
    __tablename__ = "categorias"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id")) # Aponta para o Usuário
    nome = Column(String, nullable=False)
    tipo = Column(String, nullable=False) # 'Receita' ou 'Despesa'
    cor = Column(String) # Para deixarmos o aplicativo bonitão depois

    dono = relationship("Usuario", back_populates="categorias")
    transacoes = relationship("Transacao", back_populates="categoria")

# 3. A Planta da Tabela de Transações (O Coração do DataWallet)
class Transacao(Base):
    __tablename__ = "transacoes"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"))
    categoria_id = Column(Integer, ForeignKey("categorias.id"))
    
    valor = Column(Float, nullable=False)
    tipo = Column(String, nullable=False) # 'Receita' ou 'Despesa'
    descricao = Column(String)
    data_vencimento = Column(Date, nullable=False)
    data_pagamento = Column(Date)
    status = Column(String, default="Pendente")

    dono = relationship("Usuario", back_populates="transacoes")
    categoria = relationship("Categoria", back_populates="transacoes")
