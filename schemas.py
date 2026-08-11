from pydantic import BaseModel
from datetime import date
from typing import Optional

# ==========================================
# 1. SCHEMAS DE USUÁRIO (A Porta de Entrada)
# ==========================================
class UsuarioLogin(BaseModel):
    email: str
    senha: str

class UsuarioResposta(BaseModel):
    id: int
    nome: str
    email: str

    class Config:
        from_attributes = True

# ==========================================
# 2. SCHEMAS DE CATEGORIA
# ==========================================
class CategoriaCriar(BaseModel):
    nome: str
    icone: str
    cor: str

class CategoriaResposta(BaseModel):
    id: int
    nome: str
    icone: str
    cor: str
    usuario_id: int

    class Config:
        from_attributes = True

# ==========================================
# 3. SCHEMAS DE TRANSAÇÃO (Aba Início)
# ==========================================
class TransacaoCriar(BaseModel):
    valor: float
    tipo: str # 'receita' ou 'despesa'
    descricao: str
    data_vencimento: date
    categoria_id: int

class TransacaoResposta(BaseModel):
    id: int
    valor: float
    tipo: str
    descricao: str
    data_vencimento: date
    categoria_id: int
    usuario_id: int

    class Config:
        from_attributes = True

# ==========================================
# 4. SCHEMAS DE DÍVIDAS (O Kanban)
# ==========================================
class DividaCriar(BaseModel):
    descricao: str
    valor: float
    data_vencimento: date

class DividaResposta(BaseModel):
    id: int
    descricao: str
    valor: float
    data_vencimento: date
    status: str
    usuario_id: int

    class Config:
        from_attributes = True

# ==========================================
# 5. SCHEMAS DE PLANOS (Metas e Gamificação)
# ==========================================
class PlanoCriar(BaseModel):
    nome: str
    valor_meta: float
    cor: str

class PlanoAporte(BaseModel):
    valor: float # Usado apenas para quando você for injetar dinheiro na meta

class PlanoResposta(BaseModel):
    id: int
    nome: str
    valor_atual: float
    valor_meta: float
    cor: str
    usuario_id: int

    class Config:
        from_attributes = True
