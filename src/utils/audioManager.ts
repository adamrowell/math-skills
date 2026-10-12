// Audio Manager for Arcade Games
// Handles preloading, playing, and managing sound effects

type SoundId =
  | 'correct'
  | 'wrong'
  | 'explosion'
  | 'powerup'
  | 'levelup'
  | 'gameover'
  | 'coin'
  | 'click'
  | 'whoosh'
  | 'combo'
  | 'tick'
  | 'ding'
  | 'buzz'
  | 'laser'
  | 'chomp'
  | 'hit';

// Base64 encoded minimal sound effects (short beeps/tones)
// These are tiny audio clips that work without external files
const SOUND_DATA: Record<SoundId, string> = {
  // Correct answer - pleasant ding
  correct: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleRc6i9LonHcFMYDR3p5+FjaD096ZfBo4g9LdnH8XOoPT3Zt+GjmF09yagxY7hdPcmoMWO4bS25uCFTqH0tuahBU6h9LbmoQUOofS25mFFDqI0tqZhhQ5iNHamYYTOInR2ZqGEzmJ0dmZhhM5idHZmYcSOYnQ2JqHEjmJ0NiahxI5idDYmocSOYnQ2JqHEjiJ0NiZhxI4idDYmYcSOYnQ2JmHEjmJ0NiahxI5idDYmocROYrQ2JqHETmK0NiahxE5itDYmocROYvQ15uHETmL0NebhxE5i9DXm4cRN4vQ15yHETaM0NechxA2jNDXnIgQNo3P15yIEDaNz9aciBA2jc/WnIgQNY3P1p2IEDWN0NadiA81jtDVnYkPNY7Q1Z2JDzWO0NWeiQ81j9DUnokONY/Q1J6JDjWP0NSfiQ41kM/Tn4kONZDP05+JDjWQz9OfiQ41kM/UoIkONZHP05+JDjaRz9OfiQ41kc/ToIkONZHP05+JDzWSz9OfiQ81ks/TnokPNZPP0p6JDzaT0NKeiRA1k8/SnokQNJTP0p6JEDSTz9KeiRA1k8/SnokQNZPP0p+JEDWTz9KfiRA0k8/Sn4kQNJPP0p+JEDWU0NKgiRA1lNDSoIoQNJTQ0qCKEDOU0dGhihAzldDRoYoQM5XQ0aKKEDOV0NCiihAyltDQo4oPMpbQz6OKDzKW0M+jih8yls/Oo4sfMpbPzqSLHzGWz86kix0xlc/OpIsdMZXPzqSLHDGVz86lix0xlc/OpIscMJXPz6WLGzGVz8+lix0xlc/PpYsdL5XPz6aLGy+VztCnixsvlc3RqYsaL5TN0aqLGS2UzdGqixktk8zTrIsYLJPM1K2LGCuTy9Stixgqk8vUrosXKpLL1K+MFymSytOvjBcoksrUr4wWKJLK1LGMFieRydSxjRYnkMjUs40WJpDI1LSNFSaQyNS1jRUlj8fUto4UJZDH07aOFCSPx9S3jhQkj8bTuI8TI47G07mPEyKOxtO5kBMijoXSuZATIY6F0rqRFCCNhNG7khQgjITRu5MUII2E0byUEx+Ng9C8lRMfjoPQvJYTHo2Dz7yXEx6Mgs+9mBQdjILOvpgUHYyCzr6ZFByLgc6+mhQcioHNv5sUG4qAzL+cFBqKgMy/nRUaiX/MwJ4VGYl/y8CfFhmJf8rAoBYYiH7KwaEXGIh9ycGiFheHfMnCoxcWhXvIwqQYFoV7yMKlGRWFesnCphoUhHjJwqcbFIN3yMOoGxODdsf/',

  // Wrong answer - buzzer
  wrong: 'data:audio/wav;base64,UklGRpYFAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YXIFAACAgICAgICAgICAgICAgICAgICAgHx3dHFvb3B0eH6EiY+Uk5KQjo2MjI2Njo+RkpSVlJSSkI6LiYeGhoaGh4mLjpGTlJSSkI6LiIaEg4ODg4SGiIqOkZOUlJKQjYuIhoSCgoKChISGiYyPkZOUk5GQjYuJhoSCgIGBgoSGiYuOkJKTk5KQjouJhYSCgYGBgoOFh4qNkJKTk5KQjYuIhYOBgICBgoOFiIuOkZKTk5GPjYqIhYOBgICBgoSGiIuOkJKTk5GPjYqHhYOBgICBgoSGiYuNkJKTko+NjIqHhYOBgICBg4SHiYuNkJKSkpCOi4mGhIKBgICBg4SHiYuNj5GSko+OjImGhIKBgICCg4WHiYuNj5GSkpCOjImGhIKAgICCg4aIiouOkJGSko+OjImGhIOBAP8A/wD/AP8A/wCBg4aIiouOkJGSko+OjImGhIKAgICCg4aIiouOkJGSkpCOjIqHhIOBgICBgoWHiYyOkJKSko+NjImHhIOBgIGCg4aIi42Pj5KSkpCPjYqHhIKAgICCg4aIi42PkJKSkpCOjImGhIKAgIGCg4aIi42PkZKSko+NjImHhIOBgIGCg4aIi42PkZKSko+NjImHhIOBgIGCg4aIi42PkZKSko+NjImHhIOBgIGCg4aIi42PkZKSko+NjImHhIOBgIGChIaJi46QkZKRj42LiYeEgoGAgYKEh4mLjpCRkpGPjYuJh4SCgYCBgoSHiYyOkJGSkY+NjImHhIKBgICBgoSHiYyOkJGSkY+NjImHhIKBgICBgoSHiYuOkJGSkY+NjImHhYOBgICBgoSGiIuOkJGSkY+NjImHhYOBgIGBgoSGiIuNkJGSkY+NjImHhYOBgIGCgoSGiIuOkJGSkZCOjIqHhYOBgICBgoSGiIuNkJGRkY+OjIqHhYOBgICBgoOFiIqNj5GRkZCOjIqIhoSCgICAgYKEhoiLjZCRkZGPjoyKh4WDgYCAgYKEhoiLjZCRkZCPjoyKiIaEgoGAgYKDhYeKjI+RkZGQj42LiYeGhIKBgIGCg4WHioyPkZGRkI+NjImHhYSDgYCBgoOEhoiLjY+RkZGQj42LiYeGhIOBgIGCg4SGiIuNj5GRkY+OjYuJh4aEg4GAgYGDhYeJjI6QkJGQj42LiomIhoSCgYGBgoSFh4qMjpCQkZCPjoyLiYeGhIOCgYGCg4WHiYuNj5CQkI+OjYuKiIaFhIOCgYGCg4WGiIqMjpCQkI+OjYuKiIaFhIOCgQA=',

  // Explosion - boom
  explosion: 'data:audio/wav;base64,UklGRrQDAABXQVZFZm10IBAAAAABAAEAIlYAABJWAAABAAgAZGF0YZADAACAf3x5d3d4e36Bg4WFhoaFhIKAf317enp7fH+BhIaHiImJiIeGhIJ/fXx7e3x9f4KFh4mKioqKiYiGhIOBf31+fn+Ag4aIioqLi4qJiIaEgoF/f39/gYSHiouMjIyLioiGhIKAf35+f4GEh4qLjI2NjYuKiIaEgYB/f3+AgoWIi42OjY2Mi4qIhoSBgH9/f4GChoeKjI2OjYyLioiFg4GAf3+AgYOGiIuMjY6NjIuJh4WDgYB/f4CBgoWHiouNjo2MjIqIhoSDgYB/gICCg4aIi4yNjo2MjIqIhoSCgYB/gICBg4WHiouNjY2MjIuJh4WDgn+AgICBgoSGiIqMjY2NjIuJh4WDgYCAgICAgoOFh4qLjI2NjYuKiIaFg4GAgICAgYKEhoiKjI2NjYuKiIaEg4GAgICAgYKEhoiKjI2NjIqKiIaFg4GAgICAgYKEhoeJi4yNjIyKiYeGhIKBgICAgIGChIaIiouMjIyLiomHhoSCgYCAgICBgoSGiIqLjIyMiomIhoWDgoCAgICBgoSGiIqLjI2LiomIhoWDgoGAgICBgoSGiIqMjIyLiomHhoSDgYCAgIGBgoSGiIqLjIyLiomHhoSDgoGAgICBgoSFh4mLjIuLiomIhoWEgoGAgIGBgoOFhomKi4yLiomIh4aEg4KBgICBgYKEhYeJi4uLi4mJiIeGhIOCgYCAgYGCg4WGiImLi4qKiYiHhYSEg4KBgYCBgYKDhYaIiYqLiomIh4aFhIOCgYGAgYGCg4SFh4iJioqJiYiHhoWEg4KBgYCBgYKDhIaHiYqKiomIh4aFhIOCgoGBgYGCgoSFhoeJioqJiYiHhoWEg4OCgYGBgYKCg4WGh4mJiomJiIeGhYSEg4KBgYGBgoKDhYaHiYmJiYiIh4aFhISCgoGBgYGCgoOEhoeIiYmJiIiHhoWEg4OCgoGBgYKCg4SGh4iJiYiIh4eGhYSEg4KCgYGBgoKDhIWGh4iJiIiHh4aFhISEg4KCgYGCgoOEhYaHiIiIiIeHhoWFhIODgoKBgYKCg4SEhoaHiIiIh4eGhYWEhIOCgoKCgoKDg4SFhoeHiIeHhoaGhYSEg4KCgoKCgoODhIWGh4eIh4eGhoWFhISEg4OCgoKCg4OEhIWGh4eHh4aGhoWFhISDgoKCgoKDg4SEhYaHh4eGhoaFhYSEhIODgoKCg4ODhIWFhoeHhoaGhYWFhISDg4KCgoKDg4SEhYWGh4aGhYWFhYSEhIODgoKCg4ODhISFhYaGhoaFhYWFhISEg4OCgoKDg4OEhIWFhoaGhoWFhYSEhISEg4ODg4ODg4SEhYWFhoaFhYWFhYSEhIODg4ODg4OEhISFhYWFhoWFhYWEhISEg4ODg4ODhISDhISFhYWFhYWFhYWEhISEg4ODg4OEhISEhIWFhYWFhYWEhISEhIODg4OEhISEhIWFhYWFhYWEhISEg4ODhIOEhISEhYWFhYWFhYSEhISEg4ODg4SEhISEhYWFhYWFhISEhISDg4OEhISEhISFhYWFhYSEhISEhISEhISEhISD',

  // Power-up collect
  powerup: 'data:audio/wav;base64,UklGRmoDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YUYDAACAe3d1dXh+hY2UmZqYlI2Fb2NdZHSJnrC7wb25qpF3Y1RYbYikyN3s8e/h0bl4XFFVZ4Ooyu/+//768uPLoXVWTlVljrHa+P////748t/Ij2lOTV9xmL7j/P///vvx3sqPaE5PYHOawef//P//+/Dd1JRuU1FkeJvF5fn//v369+jczJt0WVVheJ/M6fz+/fv37eDTxJhyWFtngaTO6v3+/Pr259/Sy5t2W11phqrT7v7++/n26N3Syp95X15ri67Y8f/++/j05t3Uy6F8YWBtja7a8v/++/f15d3Uy6N/Y2JukK/d9f/9+vbz5N3UzKOBZGNwkrHf9v/++fb05dzTzKWDZ2Vyk7Pg9v/9+fXz5NzTzaeGaGdzlbTi+P/8+PTz5N3TzKiIaWh0l7bl+f/7+PPy5N3UzqqKa2l2mbfm+v/79/Px49zTzauMbWt3mrnp+//6+PLx49zUzq2Nb2x4nbvq/P/59/Hw49zU0K+PcG15n73r/f/49/Hw4tvTz7CPcW97oL7s/v/49vHv4tvT0LGRc297osDs/v74/PDv4trS0LKRBP748O7h2dLRspJzb3ujwu3+//j38O3h2dLS',

  // Level up fanfare
  levelup: 'data:audio/wav;base64,UklGRjQEAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YRAEAABkZWhoaGloZ2VjYmFhYmNlZ2lrbnFzdXd4eHl4d3Z0cW9saWhkYV5bWllZW11gZGlucnZ6fX+Bg4SGh4iIiIeFg4B9enZybmpmYl5aV1RTU1VYXGFmbXN5foOIjJCUlpmbnJ2cnJuYlZGNiIR/e3ZwamRfWlVRT01MTU9SV1xjam90e4KIjpSaoKWpra+wsrKwrqqlnpeOhXxyaV9WT0hCPTs7PUBHUG1+kaPAyNLb4OTn6enp5+Xh2tLIv7Onju7V1c/Kx8bFxcfKz9Xa3+Ho7vT5/v8A//36',

  // Game over
  gameover: 'data:audio/wav;base64,UklGRsoBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YaYBAACAgH5+fn6AgIOGiYyOkJKTlJWVlZSSkI2KhoOAf359fX5/goaJjI+RlJaXmJmZmJaUkY2JhYKAf35+f4CGio2QkpWXmZqam5qYlpOPjIiEgYCAf4CChoqNkJOVl5mam5uamJaTkIyJhoKBgYGBhIeKjpCTlZeZmpubmpiWk5CNioeDgoGBgoWIi46QkpSWl5mZmZiXlZKPjImGhIKCg4SHio2PkZOVlpeXl5aVk5CPjImHhYSEhYeJi46QkpSVlpaWlZSTkI6LiYeGhYWGh4mLjY+RkpSUlZWVlJOSkI6MiomIh4eHiIqMjY+RkpOUlJSUk5KQj42LioiIiImJi4yOj5CRkpOTk5OSkZCOjYyLioqKioqLjI2Oj5CRkZKSkZGQj46NjIyLi4uLi4yMjY6PkJCRkZGQkI+OjY2MjIyMjIyMjI2Njo+PkJCQkI+Pjo6NjY2MjIyMjIyNjY2Ojo+Pj5CPj46OjY2NjYyNjI2NjY2OjY6Ojo+Pj4+Pjo6OjY2NjY2NjY2NjY6Ojo6Ojo+Pj4+Pjo6OjY6NjY2NjY2NjY6OjY6Ojo6Pj4+Pj4+Ojo6Njo2NjY2NjY2Ojo6Ojo6Pjo6Ojo6Ojo6OjY2NjY2NjY2Njo6Ojo6Ojo6Ojo6Ojo6OjY6NjY2NjY2Ojo6Ojo6Ojo6O',

  // Coin collect
  coin: 'data:audio/wav;base64,UklGRjQCAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YRACAABdXV1dXl9gYWJkZmdpam1vcHJ0dnd5ent8fX5+f39+fn18e3p4d3VzcG5saWdkYl9dW1lYWFhZWlxfYmVoa25xdHd5e31+f4CAf359e3l3dHFuamdiXltYVlRSUlJTVVhbX2Nnamxwc3Z5e31/gIGBgYB/fnx6d3RxbWpmYl5bWFVTUVBQUFJUV1tdYWVpbG9ydXh7fX+AgYGBgYB/fXt5dnNwbGhkYV1aV1VTUVBPUFFTVVhbX2JmaWxtcHN2eXt9f4CBgYGAf358end0cG1pZmJfXFpXVVNRUFBQUVNVWFteYWVoa21wcnV4ent9f4CAgYGAf35+fHp4dXJvbGlmY2BdW1hWVFNRUFBQUVJUV1lcX2JlZ2psbG9xdHZ5e31+f4CAgYCAfn18enl3dHJwbWtpZmRhXltZV1VUVFNTU1RVV1laXF5gYmRmZ2lrbG5wc3V3eXp8fX5/gICAgH9+fXx7enl3dnRycG5ta2poZmRjYWBeXVxbW1paW1tcXV5fYWJjZGVmaGlqa2xtbnBxcnR1dnd4eXp7fH1+fn9/f39/fn59fHx7enl4d3Z1dHNycG9ubWxramloZ2ZlZGNiYWFgYF9fX19fX2BgYWFiY2RkZWZnaGhpamtsbW1ucHBxcnN0dHV2d3h4eXp6e3x8fX19fn5/f3+AgICAgA==',

  // Button click
  click: 'data:audio/wav;base64,UklGRi4AAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoAAACAgICAgICAgIA=',

  // Whoosh (for movement)
  whoosh: 'data:audio/wav;base64,UklGRrQBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YZABAACAgH9+fn5/gYSHi4+SlZibnZ6fn56cm5mWko+LiIWDgoGBgoOFiIuPkpaZm52eoKChoJ+dnJmWko+MiYaDgoGBgoSGiYyQk5aZm52eoKChoJ+enJqXlJCNioeFg4KBgoOFh4qNkJOWmJudnqChoKCfnp2alpeUkY6LiYaEg4KDhIaIioyPkpSXmZudnZ+goKCfnp2bmJWTkI6LiYeGhISFhoeJi42PkpSWmJqbnZ6fn5+fnp2bmZeTkI6MioiHhoWFhoeIiouNj5GUlZeZmpydn5+fn56dnJqYlpOQjo2LiYiHhoeHiIqLjI6QkpSWl5manJ2enp+fn56dnJuZl5WTkY+NjIqJiIiIiImKi4yOj5GSlJaXmZqbnJ2enp6enp2cm5qYl5WUkpGPjoyLioqJiYmKiouMjY6PkZKTlZaXmJqam5ycnJycnJuamZiXlpSUkpGQj46NjIyLi4uLi4uMjI2Ojo+QkZKTlJWWl5iZmZqampqampmZmJeXlpWUk5OSkZCQj46OjY2MjIyMjIyNjY6Ojo+QkJGSkpOUlJWVlpaWl5eXl5eXl5aW',

  // Combo milestone
  combo: 'data:audio/wav;base64,UklGRkoBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSYBAABfX19gYGFiY2RlZmhoaWprbG1ub3Bxc3N0dXZ3eHh5ent7fH19fn5/f4CAgIB/f39+fn18fHt6enl4d3d2dXR0c3JxcXBvbm5tbGtqamlpZ2dmZWRkY2JhYGBfXl5dXV1dXVxcXV1dXV5eXl9fYGBhYmNjZGVmZ2hpaWprbG1ub3BxcXJzdHV1dnd3eHl5enp7e3x8fX1+fn5/f39/gICAf4B/f39/fn5+fX19fHx8e3t6enl5eXh4d3d3dnZ1dXR0c3NycnFxcHBwb29ubm1tbWxsa2tqamloaGdnZmZlZWRkY2NiYmFhYGBgX19eXl5dXV1dXVxcXFxcXFxcXFxdXV1dXl5eX19gYGFhYmJjY2RkZWZmZ2doaGlpamtrbGxtbm5vb3BwcXJyc3N0dHV1dnZ3d3h4eXl6ent7fHx9fX5+fn9/f4CAf3+A',

  // Clock tick
  tick: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAACA',

  // Ding (correct chime)
  ding: 'data:audio/wav;base64,UklGRooBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YWYBAABgYGFiYmNkZGVmZmdoaGlqamtsbG1ub25vcHBxcXJyc3N0dHV1dXZ2d3d3eHh4eXl5enp6e3t7e3x8fHx9fX19fn5+fn5/f39/f4CAgICAf4B/f39/fn5+fX19fHx8e3t6enl5eHh3d3Z2dXV0dHNzcnJxcXBwb29ubm1tbGxra2pqaWloaGdnZmZlZWRkY2NiYmFhYGBfX15eXV1cXFtbWlpZWVhYV1dWVlVVVFRTU1JSUVFQUFBPTk5OTU1MTExLS0pKSklJSUhISEdHR0ZGRkVFRURERENDQ0JCQkFBQUBAQD8/Pz4+Pj4+PT09PDw8Ozs7Ozs6Ojo5OTk5OTg4ODg3Nzc3NzY2NjY2NTU1NTU0NDQ0NDMzMzMzMzIyMjIyMTExMTExMDAwMDAwMC8vLy8vLy4uLi4uLi0tLS0tLS0sLCwsLCwsLCsrKysrKysrKioqKioqKioqKSkpKSkpKSkpKCgoKCgoKCgoKCcoJycnJycnJycnJyYm',

  // Buzz (wrong sound)
  buzz: 'data:audio/wav;base64,UklGRkQBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSABAACAf4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gIA=',

  // Laser (shooter game)
  laser: 'data:audio/wav;base64,UklGRpoBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YXYBAACAhYuQlJido6impp+Vhn1wYlZLQjk0MC8xNj1GUFxpdYOPlpyfoJ6aj4F0ZVdKPTMsJyYoLTVASFRgbHiBjpaeoKCblYyBdWpeUkY8NC0oJSUpL0NWaXuPocPUz8W2oYd0ZllPRz88OTc3Ozg7P0lYaHmKm6m1vL67s6mekYZ9c2xmaGhrbXR6gYmSmp+in5qUjYR7cm1paGdoaWxwdXuBiI+Un6SnoZ2Xj4eBfHd1dXZ4eXt9gIOGiYyPkZORkI+OjIqIhoSCgYCAgICAgoOEhYaHiImJioqJiYiHh4aFhIOCgYCAgICAgYGBgoKCg4ODg4OEhISDg4KCgYGBgIGBgYGBgYGBgYGBgYGBgYKCgoKCgoKCgoKBgYGBgYGBgYGBgYGBgYGBgYGBgYKCgoKCgoKCgoKBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGA',

  // Chomp (pac-man eating)
  chomp: 'data:audio/wav;base64,UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAABqc3x/f3x0aV1TTE9YZXOAiI2NiYF3bGRfYGlxeYCFh4aDfnZuaGRlamx1e4GFhoWCfnlyamRiZGdscHd9gYODgX14c25qZmVmaWxwdHl9gA==',

  // Hit (damage taken)
  hit: 'data:audio/wav;base64,UklGRlgAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YTQAAAB/gIGCgoKBgH9+fXx8fHx9fn9/gICAf39+fn19fX19fn5/f4CAgIB/f39+fn5+fn5+f3+AgICAgA==',
};

class AudioManager {
  private sounds: Map<SoundId, HTMLAudioElement> = new Map();
  private enabled: boolean = true;
  private volume: number = 0.5;
  private initialized: boolean = false;

  constructor() {
    // Initialize sounds lazily
  }

  private initializeSounds(): void {
    if (this.initialized) return;

    Object.entries(SOUND_DATA).forEach(([id, data]) => {
      try {
        const audio = new Audio(data);
        audio.preload = 'auto';
        this.sounds.set(id as SoundId, audio);
      } catch (e) {
        console.warn(`Failed to load sound: ${id}`, e);
      }
    });

    this.initialized = true;
  }

  play(soundId: SoundId, volumeMultiplier: number = 1): void {
    if (!this.enabled) return;

    // Initialize on first play (handles autoplay restrictions)
    this.initializeSounds();

    const audio = this.sounds.get(soundId);
    if (audio) {
      try {
        // Clone the audio to allow overlapping sounds
        const clone = audio.cloneNode() as HTMLAudioElement;
        clone.volume = Math.min(1, Math.max(0, this.volume * volumeMultiplier));
        clone.play().catch(() => {
          // Silently handle autoplay restrictions
        });
      } catch (e) {
        // Silently handle errors
      }
    }
  }

  playCorrect(): void {
    this.play('correct', 0.6);
  }

  playWrong(): void {
    this.play('wrong', 0.5);
  }

  playExplosion(): void {
    this.play('explosion', 0.4);
  }

  playPowerup(): void {
    this.play('powerup', 0.6);
  }

  playLevelUp(): void {
    this.play('levelup', 0.7);
  }

  playGameOver(): void {
    this.play('gameover', 0.6);
  }

  playCoin(): void {
    this.play('coin', 0.5);
  }

  playClick(): void {
    this.play('click', 0.3);
  }

  playCombo(): void {
    this.play('combo', 0.6);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  getVolume(): number {
    return this.volume;
  }

  toggle(): boolean {
    this.enabled = !this.enabled;
    return this.enabled;
  }
}

// Singleton instance
export const audioManager = new AudioManager();

// React hook for using audio
export function useAudio() {
  return {
    play: (soundId: SoundId, volume?: number) => audioManager.play(soundId, volume),
    playCorrect: () => audioManager.playCorrect(),
    playWrong: () => audioManager.playWrong(),
    playExplosion: () => audioManager.playExplosion(),
    playPowerup: () => audioManager.playPowerup(),
    playLevelUp: () => audioManager.playLevelUp(),
    playGameOver: () => audioManager.playGameOver(),
    playCoin: () => audioManager.playCoin(),
    playClick: () => audioManager.playClick(),
    playCombo: () => audioManager.playCombo(),
    setEnabled: (enabled: boolean) => audioManager.setEnabled(enabled),
    isEnabled: () => audioManager.isEnabled(),
    setVolume: (volume: number) => audioManager.setVolume(volume),
    getVolume: () => audioManager.getVolume(),
    toggle: () => audioManager.toggle(),
  };
}
