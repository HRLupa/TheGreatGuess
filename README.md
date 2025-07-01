# quiz_subtitles

## Indications on the quiz functionment

You will be asked to enter some inputs at two moments during the execution of the program : when you'll guess which video the subtitle comes from and the moment where it appeared in the video. Here are some information concerning these two types of input :

### The video that contains the subtitle

The answer is expected in French, and allows some flexibility : Most of the accents are accepted, the result is case insensitive, and there are several allowed results for each videos, including the exact name of the video, the name and abbreviation of the video game when one especially is the topic of the video, and some key words that you might think of when trying to remember the video. If you try something that you think should be accepted, please open an issue and indicate what you've tried and the video you think it belongs to and I'll either add it or discuss it with you.

### The moment in time when the subtitle appeared

I provided a format that you can adapt from, the rule is that the number you enter primarily will be interpreted as a minute number, if you add a :: mark, then the figure before will be considered as a number of hours and after it will be considered as a number of minutes, and if you add a : mark, the figure before will be considered as a number of minutes and after it will be considered as a number of seconds (You can combined hours, minutes and seconds).

## How to try the quiz

### Preparation

In order to personalize the quiz, I have added some variables at the top of the file quiz_module that you'll need to run. You are invited to take a look at them in order to get what the kind of quiz that mosts suits what you want to do.

### If you have python downloaded

&nbsp;&nbsp;&nbsp;&nbsp;if you know how to clone a repository:  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Nothing to learn you, just run the "Test connaissances vidéos tgr.py" file (you might have to install unidecode if it's not already done)\
&nbsp;&nbsp;&nbsp;&nbsp;Else:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Click on Code, then download zip, then open the zip, and run the "Test connaissances vidéos tgr.py" file\

### If you don't have python downloaded

&nbsp;&nbsp;&nbsp;&nbsp;Click on Code, then on Codespaces, create a new codespace, paste in the terminal in the bottom ```pip install unidecode,msvcrt```, and then ```python "quiz_module.py"```

## If you get an error or an unexpected behavior during the execution

Please open an issue by submitting a picture of what happened while adding the most relevants details you think might have activated the error.
