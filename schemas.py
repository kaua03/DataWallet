from pydantic import BaseModel
from typing import Optional
from datetime import date

# ==========================================
# SCHEMAS DE ENTRADA (O que o Celular envia)
# ==========================================

class TransacaoCriar(BaseModel):
    valor: float
    tipo: str
    descricao: str
    data_vencimento: date
    
    # IDs para amarrar a qual usuário e categoria essa conta pertence
    usuario_id: int
    categoria_id: int

# ==========================================
# SCHEMAS DE SAÍDA (O que a API devolve para o Celular)
# ==========================================

class TransacaoResposta(BaseModel):
    id: int
    valor: float
    tipo: str
    descricao: str
    data_vencimento: date
    status: str
    
    categoria_id: int

    class Config:
        # Isso ensina o Inspetor a ler os dados direto do SQLAlchemy
        from_attributes = True
