from random import random
def RandomKernel(scale):
    print("var myArray =  array<vec3f, 3> (")
    print("vec3f("+str(round((random()*2 - 1)*scale, 2))+", "+str(round((random()*2 - 1)*scale, 2))+", "+str(round((random()*2 - 1)*scale, 2))+"),")
    print("vec3f("+str(round((random()*2 - 1)*scale, 2))+", "+str(round((random()*2 - 1)*scale, 2))+", "+str(round((random()*2 - 1)*scale, 2))+"),")
    print("vec3f("+str(round((random()*2 - 1)*scale, 2))+", "+str(round((random()*2 - 1)*scale, 2))+", "+str(round((random()*2 - 1)*scale, 2))+")")
    print(");")

RandomKernel(2)