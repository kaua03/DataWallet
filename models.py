from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from database import Base

# 1. A Planta da Tabela de Usuários
class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, nullable=False, default="Admin")
    email = Column(String, unique=True, nullable=False)
    senha_hash = Column(String, nullable=False)

    # Conexões de Inteligência: O usuário é dono de todo o resto
    categorias = relationship("Categoria", back_populates="dono")
    transacoes = relationship("Transacao", back_populates="dono")
    dividas = relationship("Divida", back_populates="dono")
    planos = relationship("Plano", back_populates="dono")

# 2. A Planta da Tabela de Categorias
class Categoria(Base):
    __tablename__ = "categorias"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id")) 
    nome = Column(String, nullable=False)
    icone = Column(String, nullable=False) # Ex: fa-burger
    cor = Column(String, nullable=False)   # Ex: text-red-500

    dono = relationship("Usuario", back_populates="categorias")
    transacoes = relationship("Transacao", back_populates="categoria")

# 3. A Planta da Tabela de Transações (O Histórico)
class Transacao(Base):
    __tablename__ = "transacoes"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"))
    categoria_id = Column(Integer, ForeignKey("categorias.id"))
    
    valor = Column(Float, nullable=False)
    tipo = Column(String, nullable=False) # 'receita' ou 'despesa'
    descricao = Column(String, nullable=False)
    data_vencimento = Column(Date, nullable=False)

    dono = relationship("Usuario", back_populates="transacoes")
    categoria = relationship("Categoria", back_populates="transacoes")

# 4. A Planta da Tabela de Dívidas (O Kanban)
class Divida(Base):
    __tablename__ = "dividas"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"))
    
    descricao = Column(String, nullable=False)
    valor = Column(Float, nullable=False)
    data_vencimento = Column(Date, nullable=False)
    status = Column(String, default="Pendente") # 'Pendente' ou 'Paga'

    dono = relationship("Usuario", back_populates="dividas")

# 5. A Planta da Tabela de Planos (Metas / Safe to Save)
class Plano(Base):
    __tablename__ = "planos"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"))
    
    nome = Column(String, nullable=False)
    valor_atual = Column(Float, default=0.0)
    valor_meta = Column(Float, nullable=False)
    cor = Column(String, nullable=False) # Ex: bg-blue-500

    dono = relationship("Usuario", back_populates="planos")
