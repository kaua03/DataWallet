from pydantic import BaseModel
from typing import Optional
from datetime import date

# Este é o molde que o celular deve respeitar ao enviar dados!
class TransacaoCriar(BaseModel):
    valor: float
    tipo: str # "Receita" ou "Despesa"
    descricao: str
    data_vencimento: date
    usuario_id: int
    categoria_id: int

# Este é o molde de como a API vai devolver a informação
class TransacaoResposta(BaseModel):
    id: int
    valor: float
    tipo: str
    descricao: str
    status: str

    class Config:
        orm_mode = True # Ensina o Pydantic a ler os objetos do SQLAlchemy
