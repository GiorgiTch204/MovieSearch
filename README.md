# Movie Semantic Search System

ეს არის საბაკალავრო ნაშრომის ფარგლებში შექმნილი სემანტიკური საძიებო სისტემა.

## როგორ გავუშვათ პროექტი:
1. გადმოწერეთ ფილმების ბაზა [TMDB 5000](https://www.kaggle.com/datasets/tmdb/tmdb-movie-metadata) და ჩააგდეთ `data/` საქაღალდეში.
2. შექმენით ვირტუალური გარემო: `python -m venv venv`
3. დააინსტალირეთ ბიბლიოთეკები: `pip install -r backend/requirements.txt`
4. გაუშვით AI ლოგიკა: `python backend/ai_logic.py`



პროექტის გაშვება:
ბექენდ სერვერის ჩასართავად გამოიყენეთ შემდეგი ბრძანება ტერმინალში:

Bash
python -m uvicorn main:app --reload
