from sqlalchemy import create_engine, Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import datetime


# ფაილის სახელი, სადაც ბაზა უნდა შეინახოს
SQLALCHEMY_DATABASE_URL="sqlite:///./users.db"

engine=create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread":False})

SeccionLocal=sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base=declarative_base()

class User(Base):
    __tablename__="users"
    id=Column(Integer, primary_key=True, index=True)
    username=Column(String, unique=True, index=True)
    email=Column(String, unique=True, index=True)
    hashed_password=Column(String)

class SearchHistory(Base):
    __tablename__ = "search_history"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    query_text = Column(String)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

def create_db():
    Base.metadata.create_all(bind=engine)

if __name__=="__main__":
    create_db()